var express = require("express");
var app = require("express")();
var http = require("http").Server(app);
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
var AWS = require("aws-sdk");
var io = require("socket.io")(http, {
  pingTimeout: 30000,
  pingInterval: 30000,
});
var port = process.env.PORT || 4000;
const logger = require("morgan");
const cors = require("express");
let awsDBConfig = {
  region: "us-east-1",
  endpoint: "http://dynamodb.us-east-1.amazonaws.com",
};
AWS.config.update(awsDBConfig);
const awsDoClient = new AWS.DynamoDB.DocumentClient();

app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type"
  );

  res.setHeader("Access-Control-Allow-Credentials", true);

  next();
});
app.use(logger("dev"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.static("public"));

app.get("/", function (req, res) {
  res.send({ response: "API Working" }).status(200);
});

app.post("/doLogin", (req, res) => {
  var params = {
    TableName: "chat",
    Key: {
      userName: req.body.userName,
    },
  };
  awsDoClient.get(params, function (err, userInfo) {
    if (err) {
      next(err);
    } else {
      console.log(userInfo);
      if (userInfo != {}) {
        if (bcrypt.compareSync(req.body.password, userInfo["Item"].password)) {
          const user = {
            socketId: userInfo["Item"]["socketId"],
            userName: userInfo["Item"]["userName"],
          };
          res.json({
            status: 200,
            message: "user found!",
            data: { user: user },
          });
        }
      } else {
        res.json({
          status: 404,
          message: "User not found, please register",
          data: null,
        });
      }
    }
  });
});

app.post("/updateUser", (req, res, next) => {
  var params = {
    TableName: "chat",
    Key: {
      userName: req.body.userName,
    },
    UpdateExpression: "set socketId = :updatedSocketId",
    ExpressionAttributeValues: {
      ":updatedSocketId": req.body.socketId,
    },
  };
  awsDoClient.update(params, function (err, result) {
    if (err) next(err);
    else
      res.json({
        status: 200,
        message: "User updated successfully",
        data: result,
      });
  });
});

app.post("/doRegister", (req, res, next) => {
  // let params = {
  //   TableName: "chat",
  //   Key: {
  //     userName: req.body.userName,
  //   },
  // };
  // awsDoClient.get(params, function (err, userInfo) {
  //   if (err) next(err);
  //   else {
  //     if (userInfo != {}) {
  //       res.json({
  //         status: 200,
  //         message: "User with the username exists. Please use a new one",
  //       });
  //     } else {
  let cryptPass = bcrypt.hashSync(req.body.password, 10);
  let input = {
    userName: req.body.userName,
    password: cryptPass,
    socketId: req.body.socketId,
  };
  let params = {
    TableName: "chat",
    Item: input,
  };
  awsDoClient.put(params, function (err, result) {
    if (err) next(err);
    else
      res.json({
        status: 200,
        message: "User added successfully",
      });
  });
  // }
  // }
  // });
});

app.post("/allUsers", (req, res, next) => {
  var params = {
    TableName: "chat",
  };
  awsDoClient.scan(params, function (err, result) {
    if (err) next(err);
    else
      res.json({
        status: 200,
        data: result["Items"],
      });
  });
});

io.on("connection", (socket) => {
  socket.emit("conn ack", { id: socket.id });
  io.emit("activeUsers", Object.keys(io.sockets.sockets));
  socket.on("send_message", (data) => {
    socket.to(data["receiverId"]).emit("received_message", {
      receiverId: data["receiverId"],
      message: data["message"],
    });
  });
  socket.on("disconnect", () => console.log("Socket disconnected"));
});

http.listen(port, function () {
  console.log("listening on *:" + port);
});
