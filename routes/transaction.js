const express = require("express");
const moment = require("moment");
const router = express.Router();

const sendMail = require("../utils/mailer");

const User = require("../models/User");
const CreditCard = require("../models/CreditCard");
const Transaction = require("../models/Transaction");

router.post("/deposit", async (req, res) => {
  const { cardNumber, expiredAt, cvv, amount } = req.body;
  let depositAmount = parseInt(amount);
  let expiredAtDate = new Date(expiredAt);
  if (cardNumber.length != 6 || cvv.length != 3) {
    return res.json({ status: 404, message: "Invalid Format of Credit Card" });
  }
  const user = await User.findOne({
    _id: req.session.user._id,
    expiredAt,
    cvv,
  }).catch((err) => {
    return res.json({ status: 500, message: err.message });
  });
  const card = await CreditCard.findOne({
    cardNumber,
    expiredAt: expiredAtDate,
    cvv,
  }).catch((err) => {
    return res.json({ status: 500, message: err.message });
  });
  if (!card) {
    return res.json({ status: 404, message: "Credit Card not Supported" });
  }
  if (card.balance == 0) {
    return res.json({ status: 404, message: "Insufficient Credit Card" });
  } else if (card.limited == true) {
    user.balance += 1000000;
    card.balance -= 1000000;
    await card.save();
    await user.save();
    const newHistory = await new Transaction({
      user: user._id,
      amount: depositAmount,
      transactionType: "deposit",
      status: "approved",
      description: "Deposit",
    })
      .save()
      .catch((err) => {
        return res.json({ status: 500, message: err.message });
      });

    return res.json({
      status: 200,
      message: "Credit Card Limited with Transaction above 1 mil",
    });
  } else {
    user.balance += depositAmount;
    await new Transaction({
      user: user._id,
      amount: depositAmount,
      transactionType: "deposit",
      status: "approved",
      description: "Deposit from Credit Card",
    }).save();
    await user.save();
    return res.json({ status: 200, message: "Deposit Success" });
  }
});
router.post("/withdraw", async (req, res) => {
  const user = await User.findOne({
    _id: req.session.user._id,
  }).catch((err) => {
    return res.json({ status: 500, message: err.message });
  });
  const history = await Transaction.find({
    user: user._id,
    transactionType: "withdraw",
    status: "approved",
  }).catch((err) => {
    return res.json({ status: 500, message: err.message });
  });
  //check if user have withdraw 2 time in 24 hours
  if (history) {
    let count = 0;
    for (let his of history) {
      //use momentjs to calculate the time between two time
      let time = moment(his.createdAt);
      let timeNow = moment();
      let diff = timeNow.diff(time, "days");
      console.log(diff);
      if (diff == 0) {
        count++;
      }
    }
    if (count == 2) {
      return res.json({
        status: 404,
        message: "You have already withdraw 2 times in 24 hours",
      });
    }
  }

  const { cardNumber, expiredAt, cvv, amount } = req.body;
  let withdrawAmount = parseInt(amount);
  let expiredAtDate = new Date(expiredAt);
  if (withdrawAmount % 50000 != 0) {
    return res.json({
      status: 404,
      message: "Amount must be multiple of 50000",
    });
  }
  if (cardNumber.length != 6 || cvv.length != 3) {
    return res.json({
      status: 404,
      message: "Invalid Format of Credit Card",
    });
  }
  const card = await CreditCard.findOne({
    cardNumber,
    expiredAt: expiredAtDate,
    cvv,
  }).catch((err) => {
    return res.json({ status: 500, message: err.message });
  });
  if (!card) {
    return res.json({ status: 404, message: "Credit Card not Supported or Wrong Card Informations" });
  }
  if (user.balance < withdrawAmount) {
    return res.json({
      status: 404,
      message: "Insufficient Balance",
    });
  } else {
    if (withdrawAmount < 5000000) {
      user.balance -= withdrawAmount;
      card.balance += withdrawAmount * 0.95;
      await user.save();
      await card.save();
      await new Transaction({
        user: user._id,
        amount: withdrawAmount,
        transactionType: "withdraw",
        status: "approved",
        description: "Withdraw to Credit Card",
      }).save();
    } else {
      await new Transaction({
        user: user._id,
        amount: withdrawAmount,
        transactionType: "withdraw",
        status: "pending",
        description: "Withdraw to Credit Card",
      }).save();
    }
  }

  return res.json({ status: 200, message: "Withdraw Success" });
});

module.exports = router;