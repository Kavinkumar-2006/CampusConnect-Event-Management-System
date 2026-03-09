const express = require("express");
const path = require("path");

const app = express();

// allow public folder
app.use(express.static("public"));

// allow data folder (IMPORTANT)
app.use("/data", express.static(path.join(__dirname, "data")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "views/index.html"));
});

app.get("/events", (req, res) => {
    res.sendFile(path.join(__dirname, "views/events.html"));
});

app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "views/admin.html"));
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});

app.get("/event-register", (req, res) => {
res.sendFile(path.join(__dirname, "views/event-register.html"));
});