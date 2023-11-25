import express from "express";
import { Staff } from "../models/staff.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import uploadFile from "../utills/file-uploader.js"

const router = express.Router();
const saltRounds = 10;

async function comparePassword(plaintextPassword, hash) {
  const result = await bcrypt.compare(plaintextPassword, hash);
  return result;
}

router.get("/", async (req, res) => {
  const { currentUserToken } = req.cookies;
  try {
    const decoded = jwt.verify(currentUserToken, process.env.JWT_SECRET);
    if (decoded.currentUser.role === "admin") {
      const data = await Staff.find({ role: { $ne: "admin" } });
      res.json({
        success: true,
        decoded,
        data: data,
      });
    } else {
      res.status(400).send("Unauthorized Access");
    }
  } catch (e) {
    console.log("bad request")
    res.status(400).json({
      success: false,
      error: e,
    });
  }
});

router.get("/:emailId", async (req, res) => {
  const emailId = req.params.emailId;
  const findObj = { _id: emailId };

  try {
    const data = await Staff.find(findObj);
    if (data.length == 0) {
      res.status(404).json({
        msg: "failure",
        error: "data not found",
      });
    } else {
      res.json({
        msg: "success",
        data: data,
      });
    }
  } catch (e) {
    res.status(400).json({
      msg: "failure",
      error: e,
    });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const data = req.body;
    const plainPassword = data.password;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);
    const staff = new Staff({ ...data, password: hashedPassword });

    await staff.save();
    const token = jwt.sign({ currentUser: staff }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.cookie("currentUserToken", token, {
      secure: process.env.NODE_ENV !== "development",
      sameSite: process.env.NODE_ENV !== "development" ? 'none' : 'lax',
      httpOnly: true,
      maxAge: 60 * 60 * 1000,
    });
    res.status(201).json({
      msg: "success",
      data: Staff,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      msg: "failure",
      error: e,
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const data = req.body;
    const plainPassword = data.password;
    const emailId = data.emailId;
    Staff.findOne({ emailId: emailId })
      .then(async (staff) => {
        if (!staff) {
          res.json({ msg: "No such Email found" });
        } else if (!(await comparePassword(plainPassword, staff.password))) {
          res.json({ msg: "Wrong Password, Try again." });
        } else {
          const token = jwt.sign({ currentUser: staff }, process.env.JWT_SECRET, {
            expiresIn: "1h",
          });
          res.cookie("currentUserToken", token, {
            secure: process.env.NODE_ENV !== "development",
            sameSite: process.env.NODE_ENV !== "development" ? 'none' : 'lax',
            httpOnly: true,
            maxAge: 60 * 60 * 1000,
          });
          res.json({
            success: true,
            token,
            msg: "Hooray! You have successfully logged in",
            redirect: true
          });
        }
      })
      .catch((err) => {
        console.log(err);
      });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      msg: "failure",
      error: e,
    });
  }
});

const upload = multer();
router.patch("/", upload.single('picture'), async (req, res) => {
  try {
    let updatedData = JSON.parse(req.body.profileData);
    if (req.file) {
      const { webContentLink } = await uploadFile(req.file);
      console.log(webContentLink);
      updatedData = { ...updatedData, profilePic: webContentLink };
    }
    const findObj = { _id: updatedData._id };
    await Staff.findOneAndUpdate(findObj, updatedData);

    const token = jwt.sign({ currentUser: updatedData }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.cookie("currentUserToken", token, {
      secure: process.env.NODE_ENV !== "development",
      sameSite: process.env.NODE_ENV !== "development" ? 'none' : 'lax',
      httpOnly: true,
      maxAge: 60 * 60 * 1000,
    });
    res.json({ msg: "success", data: updatedData });
    console.log("data updated successfully");
  } catch (e) {
    console.log(e);
    res.status(500).json({
      msg: "failure",
      error: e,
    });
  }
});

router.delete("/:emailId", async (req, res) => {
  const emailId = req.params.emailId;
  const findObj = { emailId: emailId };
  const deletedUser = await Staff.deleteOne(findObj);
  if (deletedUser.deletedCount === 0) {
    // Document not found
    return res.status(404).json({ error: "User not found" });
  }

  // Document deleted successfully
  return res.status(204).json({ message: "User deleted successfully" });
});

export default router;
