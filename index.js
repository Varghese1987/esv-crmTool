const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const mongodb = require("mongodb");
const mongoClient = mongodb.MongoClient;
const bcrypt = require("bcrypt");
const randomstring = require("randomstring");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

app.use(bodyParser.json());
app.use(cors());

//production URLs:
const dbUrl = "mongodb+srv://varghese123:varghese123@cluster0-yqune.mongodb.net/<dbname>?retryWrites=true&w=majority"
const serverURL= "https://esv-crmtool.herokuapp.com";

// development URLs:
const dbUrl = "mongodb://localhost:27017";
const serverURL = "http://localhost:3000";

app.post("/addUser", (req, res) => {
  mongoClient.connect(dbUrl, (err, client) => {
    if (err) throw err;
    let db = client.db("crmTool");
    db.collection("users").findOne({ email: req.body.email }, (err, data) => {
      if (err) throw err;
      if (data) {
        res.status(400).json({
          message: "User already Exist",
        });
      } else {
        bcrypt.genSalt(2, (err, salt) => {
          bcrypt.hash(req.body.password, salt, (err, hash) => {
            req.body.password = hash;
            db.collection("users").insertOne(req.body, (err, data) => {
              if (err) throw err;
              if (data) {
                let string = randomstring.generate();
                db.collection("users").updateOne(
                  { email: req.body.email },
                  { $set: { randomstring: string, activate: false } },
                  { upsert: true },
                  (err, response) => {
                    client.close();
                    if (err) throw err;
                    if (response) {
                      let transporter = nodemailer.createTransport({
                        host: "smtp.gmail.com",
                        port: 587,
                        secure: false,
                        auth: {
                          user: "varghese87joseph@gmail.com",
                          pass: process.env.PASSWORD,
                        },
                        tls: {
                          rejectUnauthorized: false,
                        },
                      });
                      let mailOptions = {
                        from: "varghese87joseph@gmail.com",
                        to: req.body.email,
                        subject: "Activate User Account",
                        text: string,
                        html: `<a href='${serverURL}/activateuser/${string}'>Click her to Activate your Account</a>`,
                      };
                      transporter.sendMail(mailOptions, (err, data) => {
                        if (err) {
                          console.log(err);
                        } else {
                          console.log("Email Sent:" + data.response);
                        }
                      });
                      res.status(200).json({
                        message: "success",
                      });
                    }
                  }
                );
              }
            });
          });
        });
      }
    });
  });
});

app.get("/activateuser/:string", (req, res) => {
  console.log(req.params.string);
  mongoClient.connect(dbUrl, (err, client) => {
    if (err) throw err;
    let db = client.db("crmTool");
    db.collection("users").findOne(
      { randomstring: req.params.string },
      (err, data) => {
        console.log(data);
        if (err) throw err;
        if (data) {
          db.collection("users").updateOne(
            { _id: data._id },
            { $set: { activate: true, randomstring: "" } },
            { upsert: true },
            (err, data) => {
              client.close();
              if (err) throw err;
              if (data) {
                res.status(200).json({
                  message: "Please Login to make use of the service",
                });
              }
            }
          );
        } else {
          res.status(401).json({
            message: "Details doesnt match",
          });
        }
      }
    );
  });
});

app.post("/check-user", (req, res) => {
  mongoClient.connect(dbUrl, (err, client) => {
    if (err) throw err;
    let db = client.db("crmTool");
    db.collection("users").findOne({ email: req.body.email }, (err, data) => {
      if (err) throw err;
      if (data) {
        let string = randomstring.generate();
        db.collection("users").updateOne(
          { email: data.email },
          { $set: { randomstring: string } },
          { upsert: true },
          (err, response) => {
            client.close();
            if (err) throw err;
            if (response) {
              let transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 587,
                secure: false,
                auth: {
                  user: "varghese87joseph@gmail.com",
                  pass: process.env.PASSWORD,
                },
                tls: {
                  rejectUnauthorized: false,
                },
              });
              let mailOptions = {
                from: "varghese87joseph@gmail.com",
                to: req.body.email,
                subject: "Change Password",
                text: string,
                html: `<a href='${serverURL}/resetpwd/${string}'>Click her to Rest password</a>`,
              };
              transporter.sendMail(mailOptions, (err, data) => {
                if (err) {
                  console.log(err);
                } else {
                  console.log("Email Sent:" + data.response);
                }
              });
              res.status(200).json({
                message: "success",
              });
            }
          }
        );
      } else {
        res.status(401).json({
          message: "Email doesnt exist",
        });
      }
    });
  });
});

app.put("/reset-password/:string", (req, res) => {
  //console.log(req.params.string)
  mongoClient.connect(dbUrl, (err, client) => {
    if (err) throw err;
    let db = client.db("crmTool");
    db.collection("users").findOne(
      { randomstring: req.params.string },
      (err, data) => {
        if (err) throw err;
        if (data) {
          bcrypt.genSalt(10, (err, salt) => {
            bcrypt.hash(req.body.password, salt, (err, hash) => {
              req.body.password = hash;
              db.collection("users").updateOne(
                { randomstring: req.params.string },
                { $set: { password: req.body.password, randomstring: "" } },
                { upsert: true },
                (err, data) => {
                  client.close();
                  if (err) throw err;
                  if (data) {
                    res.status(200).json({
                      message: "Password updated",
                    });
                  }
                }
              );
            });
          });
        } else {
          res.status(401).json({
            message:
              "Details doesnt match generate a fresh link to reset the password",
          });
        }
      }
    );
  });
});

app.post("/login", (req, res) => {
  mongoClient.connect(dbUrl, (err, client) => {
    let db = client.db("crmTool");
    db.collection("users").findOne({ email: req.body.email }, (err, data) => {
      client.close();
      if (data) {
        if (data.activate) {
          bcrypt.compare(req.body.password, data.password, (err, result) => {
            if (result) {
              jwt.sign(
                { userid: data._id },
                "qwert",
                { expiresIn: "1h" },
                (err, token) => {
                  res.status(200).json({
                    message: "success",
                    token: token,
                    userId: data._id,
                  });
                }
              );
            } else {
              res.status(401).json({
                message: "Wrong Credentials",
              });
            }
          });
        } else {
          res.status(401).json({
            message: "User Not activated",
          });
        }
      } else {
        res.status(401).json({
          message: "User doesnt exist pls register for accessing",
        });
      }
    });
  });
});

function authenticate(req, res, next) {
  if (req.headers.authorization == undefined) {
    res.status(401).json({
      message: "Not a Valid User",
    });
  } else {
    jwt.verify(req.headers.authorization, "qwert", (err, decoded) => {
      if (decoded == undefined) {
        res.status(401).json({
          message: "Not a Valid User",
        });
      } else {
        next();
      }
    });
  }
}

app.post("/createSR/:id", [authenticate], (req, res) => {
  let objId = mongodb.ObjectID(req.params.id);
  mongoClient.connect(dbUrl, (err, client) => {
    if (err) throw err;
    let db = client.db("crmTool");
    let obj = {
      sub: req.body.sub,
      description: req.body.Description,
      created: true,
      open: true,
      inprocess: false,
      released: false,
      cancelled: false,
      completed: false,
      userId: objId,
    };
    db.collection("sr").insertOne(obj, (err, data) => {
      if (err) throw err;
      if (data) {
        res.status(200).json({
          message: "Data Updated",
        });
      }
    });
  });
});

app.post("/createLead/:id", [authenticate], (req, res) => {
  let objId = mongodb.ObjectID(req.params.id);
  mongoClient.connect(dbUrl, (err, client) => {
    if (err) throw err;
    let db = client.db("crmTool");
    let obj = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      middleName: req.body.middleName,
      company: req.body.company,
      access: req.body.access,
      email: req.body.email,
      phone: req.body.phone,
      category: req.body.category,
      new:true,contacted:false,qualified:true,lost:false,cancelled:false,confirmed:false,
      description: req.body.description,
      userId: objId,
    };
    db.collection("lead").insertOne(obj, (err, data) => {
      if (err) throw err;
      if (data) {
        res.status(200).json({
          message: "Data Updated",
        });
      }
    });
  });
});

app.post("/createContact/:id", [authenticate], (req, res) => {
  let objId = mongodb.ObjectID(req.params.id);
  mongoClient.connect(dbUrl, (err, client) => {
    if (err) throw err;
    let db = client.db("crmTool");
    db.collection("Contact").insertOne(req.body, (err, data) => {
      if (err) throw err;
      if (data) {
        res.status(200).json({
          message: "Data Updated",
        });
      }
    });
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("App started");
});
