const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const handleSocketevents = require("./ws/socket");
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get("/join", (req, res) => {
  res.render("rtc.ejs");
});

httpServer.listen(port, () => {
  console.log("Server started at port " + port);
});

// handling socket events
handleSocketevents(io);
