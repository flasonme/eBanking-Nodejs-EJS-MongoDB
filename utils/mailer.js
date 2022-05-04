const nodemailer = require("nodemailer");

const sendMail = async (to, subject, html) => {
  const transporter = await nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
    },
  });
  const mailOptions = {
    from: process.env.EMAIL,
    to,
    subject,
    html,
  };
  await transporter.sendMail(mailOptions);
};
module.exports = sendMail;
