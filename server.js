require("dotenv").config();
const path = require("path"),
  express = require("express"),
  mongoose = require("mongoose"),
  session = require("express-session"),
  MongoStore = require("connect-mongo"),
  layout = require("express-ejs-layouts"),
  methodOverride = require("method-override"),
  multer = require("multer");
const User = require("./models/User"),
  Item = require("./models/Item"),
  Claim = require("./models/Claim");
const { ensureAuth, ensureAdmin } = require("./middleware/auth");
const app = express();
const upload = multer({
  dest: path.join(__dirname, "public/uploads"),
  limits: { fileSize: 4 * 1024 * 1024 },
});
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/findly")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err.message));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(layout);
app.set("layout", "layouts/main");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-me",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/findly",
    }),
  }),
);
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user;
  res.locals.path = req.path;
  res.locals.success = req.session.success;
  res.locals.error = req.session.error;
  delete req.session.success;
  delete req.session.error;
  next();
});
const categories = [
  "Electronics",
  "Keys",
  "Wallet & ID",
  "Bags",
  "Clothing",
  "Jewelry",
  "Documents",
  "Other",
];
app.get("/", async (req, res) => {
  const recent = await Item.find({ status: "open" })
    .sort("-createdAt")
    .limit(6)
    .populate("owner");
  const [lost, found, resolved] = await Promise.all([
    Item.countDocuments({ type: "lost", status: "open" }),
    Item.countDocuments({ type: "found", status: "open" }),
    Item.countDocuments({ status: "resolved" }),
  ]);
  res.render("home", { recent, stats: { lost, found, resolved } });
});
app.get("/items", async (req, res) => {
  const { q = "", type = "", category = "", location = "" } = req.query;
  const filter = { status: { $ne: "resolved" } };
  if (q) filter.$text = { $search: q };
  if (type) filter.type = type;
  if (category) filter.category = category;
  if (location) filter.location = new RegExp(location, "i");
  const items = await Item.find(filter).sort("-createdAt").populate("owner");
  res.render("items/index", {
    items,
    categories,
    filters: { q, type, category, location },
  });
});
app.get("/items/new", ensureAuth, (req, res) =>
  res.render("items/form", { item: {}, categories, edit: false }),
);
app.post("/items", ensureAuth, upload.single("image"), async (req, res) => {
  const item = await Item.create({
    ...req.body,
    image: req.file ? "/uploads/" + req.file.filename : "",
    owner: req.session.user._id,
  });
  req.session.success = "Your report is now live.";
  res.redirect("/items/" + item._id);
});
app.get("/items/:id", async (req, res) => {
  const item = await Item.findById(req.params.id).populate("owner");
  if (!item)
    return res.status(404).render("error", { message: "Item not found." });
  const claims =
    req.session.user &&
    (String(item.owner._id) === req.session.user._id ||
      req.session.user.role === "admin")
      ? await Claim.find({ item: item._id }).populate("claimant")
      : [];
  res.render("items/show", { item, claims });
});
app.get("/items/:id/edit", ensureAuth, async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (
    !item ||
    (String(item.owner) !== req.session.user._id &&
      req.session.user.role !== "admin")
  )
    return res
      .status(403)
      .render("error", { message: "You cannot edit this item." });
  res.render("items/form", { item, categories, edit: true });
});
app.put("/items/:id", ensureAuth, upload.single("image"), async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (
    !item ||
    (String(item.owner) !== req.session.user._id &&
      req.session.user.role !== "admin")
  )
    return res.status(403).render("error", { message: "Not allowed." });
  Object.assign(item, req.body);
  if (req.file) item.image = "/uploads/" + req.file.filename;
  await item.save();
  req.session.success = "Listing updated.";
  res.redirect("/items/" + item._id);
});
app.post("/items/:id/claims", ensureAuth, async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item || item.status !== "open") {
    req.session.error = "This listing is no longer accepting claims.";
    return res.redirect("/items/" + req.params.id);
  }
  await Claim.create({
    item: item._id,
    claimant: req.session.user._id,
    message: req.body.message,
    proof: req.body.proof,
  });
  req.session.success = "Claim submitted for review.";
  res.redirect("/dashboard");
});
app.get("/dashboard", ensureAuth, async (req, res) => {
  const items = await Item.find({ owner: req.session.user._id }).sort(
    "-createdAt",
  );
  const claims = await Claim.find({ claimant: req.session.user._id })
    .populate("item")
    .sort("-createdAt");
  res.render("dashboard", { items, claims });
});
app.get("/admin", ensureAuth, ensureAdmin, async (req, res) => {
  const claims = await Claim.find({ status: "pending" })
    .populate("item claimant")
    .sort("-createdAt");
  res.render("admin", { claims });
});
app.put("/claims/:id", ensureAuth, ensureAdmin, async (req, res) => {
  const claim = await Claim.findById(req.params.id).populate("item");
  if (!claim) return res.redirect("/admin");
  claim.status = req.body.status;
  if (req.body.status === "approved") {
    claim.item.status = "claimed";
    await claim.item.save();
  }
  await claim.save();
  req.session.success = "Claim " + req.body.status + ".";
  res.redirect("/admin");
});
app.get("/register", (req, res) => res.render("auth/register"));
app.post("/register", async (req, res) => {
  try {
    const u = await User.create(req.body);
    req.session.user = {
      _id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
    };
    res.redirect("/");
  } catch (e) {
    req.session.error = "An account already exists with that email.";
    res.redirect("/register");
  }
});
app.get("/login", (req, res) => res.render("auth/login"));
app.post("/login", async (req, res) => {
  const u = await User.findOne({ email: req.body.email.toLowerCase() });
  if (!u || !(await u.comparePassword(req.body.password))) {
    req.session.error = "Incorrect email or password.";
    return res.redirect("/login");
  }
  req.session.user = {
    _id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
  };
  res.redirect("/dashboard");
});
app.post("/logout", (req, res) => req.session.destroy(() => res.redirect("/")));
app.use((req, res) =>
  res.status(404).render("error", { message: "That page does not exist." }),
);
app.use((err, req, res, next) => {
  console.error(err);
  res
    .status(500)
    .render("error", { message: "Something went wrong. Please try again." });
});
app.listen(process.env.PORT || 3000, () =>
  console.log(
    "Findly running on http://localhost:" + (process.env.PORT || 3000),
  ),
);
