const express = require("express");
const router = express.Router();
const fs = require("fs");
const User = require("../../service/schemas/userSchema");
const { registerValidation, loginValidation } = require("../../service/schemas/validation");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const secret = process.env.SECRET_KEY;
const auth = require("../../service/token");
const gravatar = require("gravatar");
const path = require("path");
const multer = require("multer");
const jimp = require("jimp");

// Register
router.post("/signup", async (req, res) => {
	const { email, password } = req.body;

	// Validation
	const { error } = registerValidation(req.body);
	if (error) {
		return res.status(400).send(error.details[0].message);
	}

	// Does email exist
	const user = await User.findOne({ email });
	if (user) {
		return res.status(409).json({
			status: "error",
			code: 409,
			message: "Email is already in use",
		});
	}
	// Hash password
	const salt = await bcrypt.genSalt(10);
	const hashedPassword = await bcrypt.hash(password, salt);

	// Register message
	try {
		const secureUrl = gravatar.url(email, { s: "100", r: "x", d: "retro" }, true);
		const newUser = new User({ email, password: hashedPassword, avatarURL: secureUrl });
		await newUser.save();
		res.status(201).json({
			status: "success",
			code: 201,
			user: {
				email: email,
				id: newUser._id,
			},
			message: "Registration successful",
		});
	} catch (err) {
		console.error(err);
	}
});

// Login
router.post("/login", async (req, res) => {
	const { email, password } = req.body;

	// Validation
	const { error } = loginValidation(req.body);
	if (error) {
		return res.status(400).send(error.details[0].message);
	}

	// Does user exist
	const userExist = await User.findOne({ email });
	if (!userExist) {
		return res.status(401).json({
			status: "error",
			code: 401,
			message: "Email or password is wrong",
		});
	}

	// Valid password
	const validPassword = await bcrypt.compare(password, userExist.password);
	if (!validPassword) {
		return res.status(401).json({
			status: "error",
			code: 401,
			message: "Email or password is wrong",
		});
	}

	// Login logic
	const token = jwt.sign({ _id: userExist._id }, secret, { expiresIn: "1h" });
	res.header("Authorization", token);
	await User.findOneAndUpdate({ _id: userExist._id }, { token: token });

	// Login message
	try {
		res.status(200).json({
			status: "success",
			code: 200,
			user: {
				email: email,
				token: token,
			},
			message: "Login successful",
		});
	} catch (err) {
		console.error(err);
	}
});

// Logout
router.get("/logout", auth, async (req, res) => {
	const { _id } = req.user;
	const findUser = await User.findById({ _id });

	if (!findUser) {
		return res.status(401).json({
			status: "error",
			code: 401,
			message: "Unauthorized access",
		});
	}

	// Logout message
	try {
		res.header("Authorization", "").status(204).json({
			status: "success",
			code: 204,
		});
	} catch (err) {
		console.log(err);
	}
});

// Current user
router.get("/current", auth, async (req, res) => {
	const { _id } = req.user;
	const currentUser = await User.findById({ _id });
	const token = req.header("Authorization");

	// Current message
	try {
		res.status(200).json({
			status: "success",
			code: 200,
			data: {
				email: currentUser.email,
				token: token,
			},
		});
	} catch (err) {
		res.status(401).json({
			status: "error",
			code: 401,
			message: "Unauthorized access",
		});
	}
});

// Multer middleware

const uploadDir = path.join(process.cwd(), "tmp");

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, uploadDir);
	},
	filename: (req, file, cb) => {
		cb(null, file.originalname);
	},
	limits: {
		fileSize: 1048576,
	},
});

const upload = multer({
	storage: storage,
});

// Change avatar
router.patch("/avatars", upload.single("avatar"), auth, async (req, res) => {
	const { _id } = req.user;
	const { path, originalname } = req.file;

	const scaledImage = async () => {
		const image = await jimp.read(path);
		await image.resize(250, 250);
		await image.write(path);
	};
	scaledImage();
	// const filename = .join(uploadDir, originalname);
	const newAvatar = await User.findOneAndUpdate({ _id: _id }, { avatarURL: uploadDir });
	console.log(req.user);
	// Change avatar message
	try {
		// fs.rename(path, filename);
		res.status(200).json({
			status: "success",
			code: 200,
			data: {
				avatarURL: newAvatar.avatarURL,
			},
		});
	} catch (err) {
		res.status(401).json({
			status: "error",
			code: 401,
			message: "Not authorized",
		});
	}
});

module.exports = router;
