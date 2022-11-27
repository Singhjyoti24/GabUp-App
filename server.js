const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
require("dotenv").config();

const app = express();
const http = require("http").createServer(app);

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Database connection
mongoose.connect("mongodb://localhost:27017/userDB");

// Schema
const userSkeliton = new mongoose.Schema({
  uname: String,
  email: String,
  password: String,
});

const roomSchema = new mongoose.Schema({
  roomname: String,
  password: String,
  messages: [String],
});

userSkeliton.plugin(passportLocalMongoose);

const Room = new mongoose.model("room", roomSchema);
const User = new mongoose.model("user", userSkeliton);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get("/", function (req, res) {
  res.render("home");
});

app.use(function (req, res, next) {
  res.header({ "Access-Control-Allow-Origin": "*" });
  next();
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/room", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("room", { username: req.user.username });
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", function (req, res) {
  req.logout(function (err) {
    if (err) {
      console.log(err);
      res.send("Something went wrong!");
    } else {
      res.redirect("/");
    }
  });
});

app.post("/register", function (req, res) {
  User.register(
    { username: req.body.username, email: req.body.email },
    req.body.password,
    function (err, u) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/room");
        });
      }
    }
  );
});

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    email: req.body.email,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/room");
      });
    }
  });
});

// ROOM

app.get("/create-room", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("create-room");
  } else {
    res.redirect("/login");
  }
});

app.post("/create-room", function (req, res) {
  const newRoom = new Room({
    roomname: req.body.roomname,
    password: req.body.password,
  });

  newRoom.save(function (err) {
    if (err) {
      res.send(err);
    } else {
      res.redirect("/join-room");
    }
  });
});

app.get("/chat/:roomName/:roomPassword", function (req, res) {
  if (req.isAuthenticated()) {
    Room.findOne(
      { roomname: req.params.roomName, password: req.params.roomPassword },
      function (err, message) {
        if (message) {
          const userMessage = message.messages;
          res.render("chat", {
            roomName: req.params.roomName,
            roomPassword: req.params.roomPassword,
            userMessage: userMessage,
          });
        } else {
          if (err) {
            res.send(err);
          } else {
            res.render("result", {
              message: "Room has been deleted or not found.",
            });
          }
        }
      }
    );
  } else {
    res.redirect("/login");
  }
});

app.post("/chat/:roomName/:roomPassword", function (req, res) {
  if (req.isAuthenticated()) {
    const message = req.body.message;
    const username = req.user.username;
    Room.updateOne(
      { roomname: req.params.roomName, password: req.params.roomPassword },
      {
        $push: {
          messages: `${timestamp()}<br><i>[${username}]</i> :- <b>${message}</b>`,
        },
      },
      function (err) {
        if (err) {
          res.send(err);
        } else {
          res.redirect(
            `/chat/${req.params.roomName}/${req.params.roomPassword}`
          );
        }
      }
    );
  } else {
    res.redirect("/login");
  }
});

app.get("/join-room", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("join-room");
  } else {
    res.redirect("login");
  }
});

let roomy = "";
let pass = "";
app.post("/join-room", function (req, res) {
  if (req.isAuthenticated()) {
    roomy = req.body.roomname;
    pass = req.body.password;
    Room.findOne(
      { roomname: roomy, password: pass },
      function (err, foundRoom) {
        if (foundRoom) {
          res.redirect(`/chat/${roomy}/${pass}`);
        } else {
          if (err) {
            res.send(err);
          } else {
            res.render("result", {
              message: "Room Name or Room Password mismatched. Kindly Recheck.",
            });
          }
        }
      }
    );
  } else {
    res.redirect("login");
  }
});

app.get("/delete-room", function (req, res) {
  res.render("delete-room");
});

app.post("/delete-room", function (req, res) {
  const roomName = req.body.roomName;
  const roomPassword = req.body.roomPassword;

  Room.deleteOne(
    { roomname: roomName, password: roomPassword },
    function (err) {
      if (err) {
        res.send(err);
      } else {
        res.render("result", {
          message: "Room has been deleted successfully.",
        });
      }
    }
  );
});

app.get("/messages/:roomName/:roomPassword", function (req, res) {
  const roomName = req.params.roomName;
  const roomPassword = req.params.roomPassword;

  Room.findOne(
    { roomname: roomName, password: roomPassword },
    function (err, message) {
      if (message) {
        res.send(message.messages);
      } else {
        if (err) {
          res.send(err);
        } else {
          res.render("result", {
            message: "No such room is present. Kindly recheck the password or room name.",
          });
        }
      }
    }
  );
});

// Socket Connection
const io = require("socket.io")(http);

io.on("connection", function (socket) {
  socket.join(roomy);
});

io.on("connection", function (socket) {
  socket.on("message", function (msg) {
    socket.to(roomy).emit("message", msg);
  });
});

// Port listening
http.listen(3000, function (req, res) {
  console.log("Server started on port 3000!");
});
