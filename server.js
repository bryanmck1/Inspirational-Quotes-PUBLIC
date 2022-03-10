import fetch from "node-fetch";
import sgMail from "@sendgrid/mail";
import bodyParser from "body-parser";
import express from "express";
import mysql from "mysql";
import { scheduleJob } from "node-schedule";
import "dotenv/config";

//Your send grid API Key
const API_KEY = process.env.API_KEY;
sgMail.setApiKey(API_KEY);
const port = process.env.PORT || 3000;
const app = express();
app.listen(port);
app.set("view engine", "ejs");
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use("/styles", express.static("styles"));
app.use("/img", express.static("img"));

const connection = mysql.createConnection({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
});

console.log(`Server running on ${port}`);

//Renders main landing page
app.get("/", (req, response) => {
  response.render("index");
});

//Runs when an email address is submitted
app.post("/", function (req, res) {
  const user_email = req.body.email;
  const sql_email_check = `SELECT user_email FROM user_emails WHERE user_email= '${user_email}'`;
  //Checks to see if submitted email address already exists in database
  connection.query(sql_email_check, function (err, res2) {
    if (res2.length > 0) {
      res.render("already");
    } else {
      const sql = `INSERT INTO user_emails (user_email) VALUES ('${user_email}')`;
      //Adds submitted email address to database if it doesn't already exist in it
      connection.query(sql, function (err, res3) {
        if (err) throw err;
      });
      res.render("success");
    }
  });
});

//Scheduled function that once a day retreives and then sends email to all users in the database
const dailyEmail = scheduleJob("45 7 * * *", function () {
  connection.connect(function (err) {
    if (err) {
      return console.error("error: " + err.message);
    }

    console.log("CONNECTED!");
    const selectAll = `SELECT user_email FROM user_emails`;
    connection.query(selectAll, function (err, result) {
      if (err) throw err;

      //Returns database emails, that are stored as objects, as an array
      const newEmailArr = Array.from(
        Object.values(result),
        (result) => result.user_email
      );
      console.log(newEmailArr);
      async function get_request() {
        const url = "https://type.fit/api/quotes";
        const res = await fetch(url);
        const data = await res.json();
        return data[Math.floor(Math.random() * data.length)];
      }

      get_request().then((data) => {
        console.log(data);
        const quote = data.text;
        const author = data.author != null ? data.author : "Unknown";
        console.log(quote);
        const message = {
          to: newEmailArr,
          from: process.env.EMAIL_ADDRESS,
          subject: "Daily Inspiration!",
          text: `${quote} 
          
-${author}`,
        };
        sgMail
          .send(message)
          .then((response) => console.log("Email sent"))
          .catch((error) => console.log(error));
      });
    });
  });
});
