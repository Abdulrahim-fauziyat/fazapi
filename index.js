const express = require("express"); //create REST api
const bodyParser = require("body-parser"); // helps to request/parse to json
require("dotenv").config(); //read values from dotenv files(env means enviroment variables)
const cors = require("cors"); // cross origin resource sharing
const nodemailer = require("nodemailer");
const Flutterwave = require("flutterwave-node-v3");
const axios = require("axios");
const jwt = require("jsonwebtoken");

const secretKey = require("crypto").randomBytes(64).toString("hex");
// console.log("JWT_Secret_Key:", secretKey);

const bcrypt = require("bcrypt");
const saltRounds = 10;

const connectDb = require("./database.js");
const userWallet = require("./models/Wallet.js");
const TopUpModel = require("./models/Topup.js");
const AdminWallet = require("./models/AdminWallet.js");
const AdminModel = require("./models/AdminModel.js");
const userModel = require("./models/UserModel.js");
const TxModel = require("./models/transactionModel.js");

const app = express();
const port = process.env.PORT;

//Register middlewares
app.use(bodyParser.json());
app.use(cors()); //enable the cors policy to all

//connection
connectDb();

// create the REST API
// CRUD- Operation

app.post("/register", (req, res) => {
  const { fullName, phone, email, password } = req.body;

  if (!fullName || !phone || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Error hashing password", details: err });
    }

    const newUser = new userModel({ fullName, phone, email, password: hash });

    newUser
      .save()
      .then((user) => {
        const newWallet = new userWallet({ userId: user._id });

        newWallet
          .save()
          .then((wallet) => {
            res.status(200).json({
              msg: "success",
              user,
              wallet,
            });
          })
          .catch((walletError) => {
            res
              .status(500)
              .json({ error: "Error creating wallet", details: walletError });
          });
      })
      .catch((userError) => {
        res
          .status(500)
          .json({ error: "Error saving user", details: userError });
      });
  });
});
app.post("/login", (req, res) => {
  const userModel = require("./models/UserModel.js");
  const { email, password } = req.body;

  userModel.findOne({ email: email }).then((user) => {
    bcrypt.compare(password, user.password, function (err, result) {
      if (!err && result === true)
        return res.status(200).json({
          msg: "success",
          result: result,
          user: user,
        });
    });
  });
});

//api for forget password

app.post("/forgotpassword", (req, res) => {
  const userModel = require("./models/UserModel.js");
  const { email } = req.body;
  userModel.findOne({ email: email }).then((user) => {
    if (!user) {
      return res.send({ status: "User not Found" });
    } else {
      const token = jwt.sign({ id: user._id }, "JWT_Secret_Key"); //,{expiresIn:"Id"}

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "omoteabdulrahimfauziyat@gmail.com",
          pass: "frrg okng akrl xbam",
        },
      });

      const mailOptions = {
        from: "omoteabdulrahimfauziyat@gmail.com",
        to: user.email,
        subject: " Reset password Link",
        text: `http://localhost:5173/createpassword/${user._id}/${token}`,
      };

      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error);
        } else {
          return res.send({ status: "success" });
        }
      });
    }
  });
});

app.post("/createpassword", (req, res) => {
  const userModel = require("./models/UserModel.js");
  // const {id, token} = req.params
  const { password, confirmPassword, id, token } = req.body;
  if (password !== confirmPassword) {
    return res.json({ msg: "password mismatched" });
  }
  jwt.verify(token, "JWT_Secret_Key", (err, decoded) => {
    if (err) {
      return res.json({ status: "Error with token" });
    } else {
      bcrypt
        .hash(password, 10)
        .then((hash) => {
          userModel
            .findByIdAndUpdate({ _id: id }, { password: hash })
            .then((u) => res.send({ status: "success" }))
            .catch((err) => res.send({ status: err }));
        })
        .catch((err) => res.send({ status: err }));
    }
  });
});

app.post("/dashboard/profile", (req, res) => {
  const userModel = require("./models/UserModel.js");
  const bcrypt = require("bcrypt");

  const { oldPassword, newPassword, confirmPassword, id } = req.body;

  if (oldPassword === newPassword || newPassword !== confirmPassword) {
    return res.json({ msg: "password error" });
  } else {
    bcrypt
      .hash(newPassword, 10)
      .then((hash) => {
        userModel
          .findByIdAndUpdate(id, { password: hash })
          .then(() => res.json({ status: "success" })) // No need to send user data back, just status
          .catch((err) => res.json({ status: err.message })); // Sending error message
      })
      .catch((err) => res.json({ status: err.message }));
  }
});

app.get("/users", (req, res) => {
  const userModel = require("./models/UserModel.js");
  userModel.find().then((user) => {
    return res.status(200).json({
      msg: "success",
      records: user,
    });
  });
});
app.get("/userhistory", (req, res) => {
  const TxModel = require("./models/transactionModel.js");
  const { userId, page = 1, limit = 10 } = req.query;

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };

  TxModel.find({ userId: userId })
    .skip((options.page - 1) * options.limit)
    .limit(options.limit)
    .then((txrecord) => {
      TxModel.countDocuments({ userId: userId }).then((total) => {
        return res.status(200).json({
          msg: "success",
          records: txrecord,
          totalPages: Math.ceil(total / options.limit),
          currentPage: options.page,
        });
      });
    })
    .catch((error) => {
      console.error(error);
      return res.status(500).json({ msg: "Internal server error" });
    });
});

app.put("/fund", (req, res) => {
  const { amount, userId, txId } = req.body;
  const TxModel = require("./models/transactionModel.js");

  const flw = new Flutterwave(process.env.FLW_PUB_KEY, process.env.FLW_SEC_KEY);
  const payload = { id: txId };

  flw.Transaction.verify(payload).then((resData) => {
    if (resData.data.status == "successful") {
      //  update  userWallet
      userWallet
        .findOneAndUpdate(
          { userId: userId },
          { $inc: { balance: Number(amount) } },
          { new: true }
        )
        .then((response) => {
          // record the transaction
          new TxModel({
            userId: userId,
            txType: "funding",
            txAmount: amount,
            txRef: txId,
            status: "Success",
          })
            .save()
            .then((resval) => {
              console.log(resval);
            })
            .catch((err) => console.log(err));

          return res.status(200).json({ msg: response, mystatus: "success" });
        })
        .catch((err) => console.log(err));
    } else {
      return res.status(200).json({
        msg: "failed",
        data: resData,
      });
    }
  });
});

app.get("/getWallet", (req, res) => {
  const { userId } = req.query;
  const userModel = require("./models/UserModel.js");
  const userWallet = require("./models/Wallet.js");

  if (!userId) {
    return res
      .status(400)
      .json({ msg: "Invalid request, missing userId parameter." });
  }

  userWallet
    .findOne({ userId: userId })
    .then((wallet) => {
      if (!wallet) {
        return res.status(404).json({ msg: "Wallet not found." });
      } else {
        res.status(200).json({ wallet: wallet });
      }
    })
    .catch((err) => {
      console.error("Error fetching wallet:", err);
      res
        .status(500)
        .json({ error: "An error occurred while fetching the wallet." });
    });
});

app.get("/topup", (req, res) => {
  const service = {
    15: "MTN VTU",
    6: "GLO",
    1: "Airtel",
    2: "9Mobile",
  };

  const { network, amount, phone, txRef, userId } = req.query;
  console.log(network, amount, phone, txRef);

  userModel.findOne({ _id: userId }).then((user) => {
    const topupUrl = `https://mobileairtimeng.com/httpapi/?userid=${process.env.RECHARGE_API_PHONE}&pass=${process.env.RECHARGE_APIKEY}&network=${network}&phone=${phone}&amt=${amount}&user_ref=${txRef}&jsn=json`;

    console.log(process.env.RECHARGE_API_PHONE, process.env.RECHARGE_APIKEY);

    axios
      .get(topupUrl)
      .then((response) => {
        console.log(response.data);
        if (
          response.data.code == 100 &&
          response.data.message == "Recharge successful"
        ) {
          new TopUpModel({
            senderPhone: user.phone,
            receiverPhone: phone,
            amount: amount,
            txref: txRef,
            Network: service[network],
            status: "success",
          }).save();

          new TxModel({
            userId: userId,
            txType: "topup",
            txAmount: amount,
            txRef: txRef,
            status: "success",
          }).save();
          res.status(200).json({ msg: "success" });
        } else {
          res.status(200).json(response.data);
          new TopUpModel({
            senderPhone: user.phone,
            receiverPhone: phone,
            amount: amount,
            txref: txRef,
            Network: service[network],
            status: "Failed",
          }).save();

          new TxModel({
            userId: userId,
            txType: "topup",
            txAmount: amount,
            txRef: txRef,
            status: "Failed",
          }).save();
        }
      })
      .catch((error) => {
        console.error("Error: " + error.message);
      });
  });
});

app.get("/getTotalTopup", (req, res) => {
  const TxModel = require("./models/transactionModel.js");
  const { userId } = req.query;

  TxModel.find({ userId: userId, txType: "topup" }).then((response) => {
    res.status(200).json({ result: response });
  });
});

app.get("/getTotalFunding", (req, res) => {
  const TxModel = require("./models/transactionModel.js");
  const { userId } = req.query;

  TxModel.find({ userId: userId, txType: "funding" }).then((response) => {
    res.status(200).json({ result: response });
  });
});

//Admin
//GET route to fetch all admins
app.get("/alladmin", async (req, res) => {
  try {
    const admins = await AdminModel.find();
    res.status(200).json(admins);
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/adminlogin", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: "Email and password are required" });
  }

  AdminModel.findOne({ email: email })
    .then((user) => {
      if (!user) {
        console.log("User not found for email:", email); // Added logging
        return res.status(404).json({ msg: "User not found" });
      }

      bcrypt.compare(password, user.password, function (err, result) {
        if (err) {
          console.error("Error comparing passwords:", err); // Added logging
          return res.status(500).json({ msg: "Error comparing passwords" });
        }

        if (result === true) {
          // Login successful, send user details including role in response
          return res.status(200).json({
            msg: "Login successful",
            user: {
              email: user.email,
              role: user.role,
            },
          });
        } else {
          // Invalid password
          return res.status(401).json({ msg: "Invalid password" });
        }
      });
    })
    .catch((err) => {
      console.error("Database error:", err); // Added logging
      return res.status(500).json({ msg: "Database error", error: err });
    });
});

app.get("/adtxhistory", async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;
  const TxModel = require("./models/transactionModel.js");
  const userModel = require("./models/UserModel.js");

  try {
    // Count the total number of transactions
    const totalRecords = await TxModel.countDocuments();

    // Fetch the transactions with pagination
    const transactions = await TxModel.find().skip(skip).limit(limit);

    // Fetch user details for each transaction
    const transactionWithUserDetails = await Promise.all(
      transactions.map(async (transaction) => {
        const user = await userModel.findById(transaction.userId);
        return {
          ...transaction.toObject(),
          user,
        };
      })
    );

    return res.status(200).json({
      msg: "success",
      records: transactionWithUserDetails,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    return res.status(500).json({ msg: "Internal server error" });
  }
});

app.post("/AdminProfile", (req, res) => {
  const AdminModel = require("./models/AdminModel.js");
  const bcrypt = require("bcrypt");

  const { oldPassword, newPassword, confirmPassword, id } = req.body;

  if (oldPassword === newPassword || newPassword !== confirmPassword) {
    return res.json({ msg: "password error" });
  } else {
    bcrypt
      .hash(newPassword, 10)
      .then((hash) => {
        AdminModel.findByIdAndUpdate(id, { password: hash })
          .then(() => res.json({ status: "success" })) // No need to send user data back, just status
          .catch((err) => res.json({ status: err.message })); // Sending error message
      })
      .catch((err) => res.json({ status: err.message }));
  }
});



// app.put("/funduser", async (req, res) => {
//   const { amount, email, txId } = req.body;

//   // Validate request body
//   if (!amount || !email || !txId) {
//     console.error("Missing required fields");
//     return res.status(400).json({ msg: "Missing required fields" });
//   }

//   try {
//     // Fetch user information
//     const user = await userModel.findOne({ email: email });
//     if (!user) {
//       console.error("User not found");
//       return res.status(404).json({ msg: "User not found" });
//     }

//     const userId = user._id;

//     // Update userWallet balance
//     const updatedWallet = await userWallet.findOneAndUpdate(
//       { userId: userId },
//       { $inc: { balance: Number(amount) } },
//       { new: true }
//     );

//     if (!updatedWallet) {
//       console.error("User wallet not found");
//       // Record failed transaction
//       const newTransactionFailed = new TxModel({
//         userId: userId,
//         txType: "Adminfunding",
//         txAmount: amount,
//         txRef: txId,
//         status: "Failed",
//       });
//       await newTransactionFailed.save();

//       return res.status(404).json({ msg: "User wallet not found" });
//     }
       
//      console.log("Wallet updated:", updatedWallet);

//     // Record the transaction
//     const newTransaction = new TxModel({
//       userId: userId,
//       txType: "Adminfunding",
//       txAmount: amount,
//       txRef: txId,
//       status: "success",
//     });

//     const savedTransaction = await newTransaction.save();

//     console.log("Transaction recorded:", savedTransaction);

//     return res.status(200).json({ msg: updatedWallet, mystatus: "success" });
//   } catch (error) {
//     console.error("Error:", error);

//     if (userId) {
//       // Record failed transaction if userId is available
//       const newTransactionFailed = new TxModel({
//         userId: userId,
//         txType: "Adminfunding",
//         txAmount: amount,
//         txRef: txId,
//         status: "Failed",
//       });
//       await newTransactionFailed.save();
//     }

//     return res
//       .status(500)
//       .json({ msg: "Internal Server Error", error: error.message });
//   }
// });







// app.put("/funduser", async (req, res) => {
//   const { amount, email, txId } = req.body;

//   // Validate request body
//   if (!amount || !email || !txId) {
//     console.error("Missing required fields");
//     return res.status(400).json({ msg: "Missing required fields" });
//   }

//   try {
//     // Fetch user information
//     const user = await userModel.findOne({ email: email });
//     if (!user) {
//       console.error("User not found");
//       return res.status(404).json({ msg: "User not found" });
//     }

//     const userId = user._id;

//     // Update userWallet balance
//     const updatedWallet = await userWallet.findOneAndUpdate(
//       { userId: userId },
//       { $inc: { balance: Number(amount) } },
//       { new: true }
//     );

//     if (!updatedWallet) {
//       console.error("User wallet not found");
//       // Record failed transaction
//       const newTransactionFailed = new TxModel({
//         userId: userId,
//         txType: "Adminfunding",
//         txAmount: amount,
//         txRef: txId,
//         status: "Failed",
//       });

//       await newTransactionFailed.save()
//         .then(() => console.log("Failed transaction recorded"))
//         .catch(err => console.error("Failed to record transaction:", err));

//       return res.status(404).json({ msg: "User wallet not found" });
//     }
       
//     console.log("Wallet updated:", updatedWallet);

//     // Record the transaction
//     const newTransaction = new TxModel({
//       userId: userId,
//       txType: "Adminfunding",
//       txAmount: amount,
//       txRef: txId,
//       status: "success",
//     });

//     const savedTransaction = await newTransaction.save();

//     console.log("Transaction recorded:", savedTransaction);

//     return res.status(200).json({ msg: updatedWallet, mystatus: "success" });
//   } catch (error) {
//     console.error("Error:", error);

//     if (req.body.email) {
//       // Record failed transaction if userId is available
//       const newTransactionFailed = new TxModel({
//         userId: req.body.email,
//         txType: "Adminfunding",
//         txAmount: amount,
//         txRef: txId,
//         status: "Failed",
//       });

//       await newTransactionFailed.save()
//         .then(() => console.log("Failed transaction recorded"))
//         .catch(err => console.error("Failed to record transaction:", err));
//     }

//     return res.status(500).json({ msg: "Internal Server Error", error: error.message });
//   }
// });

app.put("/funduser", async (req, res) => {
  const { email, amount, txId, adminEmail } = req.body;

  // console.log(req.body);
  // return ;
  // Check if user is authorized (superadmin or admin

  try {
  
    // const admin = await AdminModel.findOne({ email:adminEmail }); 
    // if (!admin || (admin.role !== 'admin' || admin.role !== 'superadmin')) {
    //   return res.status(403).json({ msg: "Unauthorized access" });
    // }   
 
  
    // Find user by email
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const userId = user._id; 

    // Update userWallet balance
    const updatedWallet = await userWallet.findOneAndUpdate(
      { userId: userId },
      { $inc: { balance: Number(amount) } },
      { new: true }
    );

    if (!updatedWallet) {
      return res.status(404).json({ msg: "User wallet not found" });
    }

    // Record the transaction (Assuming success initially)
    

    // Attempt to save the transaction 
    try {
      new TxModel({
        userId: userId,
        txType: "Adminfunding",
        txAmount: amount,
        txRef: txId,
        status: "success",
      }).save()
        .then( resp =>{
          console.info("saving transaction:", resp);
        })
    
    } catch (error) {
      // If saving transaction fails, record a failed transaction
      new TxModel({
        userId: userId,
        txType: "Adminfunding",
        txAmount: amount,
        txRef: txId,
        status: "Failed",
      }).save();
      console.error("Error saving transaction:", error);
    }

    return res.status(200).json({ msg: updatedWallet, mystatus: "success" });
  } catch (error) {
    console.error("Error funding user:", error);
    return res.status(500).json({ msg: "Internal Server Error", error: error.message });
  }
});



app.get("/balance", (req, res) => {
  axios
    .get(
      "https://mobileairtimeng.com/httpapi/balance?userid=08139240318&pass=1bfa9b0533e929b4c4279&jsn=json"
    )
    .then((response) => {
      console.log(response.data);

      // Check for conditions before sending the response
      if (!response.data.code) {
        return res.status(400).json(response.data);
      } else {
        return res.status(200).json(response.data);
      }
    })
    .catch((error) => {
      console.error("Error fetching balance:", error);
      res.status(500).json({ msg: "Internal Server Error" });
    });
});




// app.get("/topupuser", (req, res) => {
//   const service = {
//     15: "MTN VTU",
//     6: "GLO",
//     1: "Airtel",
//     2: "9Mobile",
//   };

//   const { network, amount, phone, txRef, userId } = req.query;
//   console.log(network, amount, phone, txRef);

//   userModel.findOne({ _id: userId }).then((user) => {
//     const topupUrl = `https://mobileairtimeng.com/httpapi/?userid=${process.env.RECHARGE_API_PHONE}&pass=${process.env.RECHARGE_APIKEY}&network=${network}&phone=${phone}&amt=${amount}&user_ref=${txRef}&jsn=json`;

//     console.log(process.env.RECHARGE_API_PHONE, process.env.RECHARGE_APIKEY);

//     axios
//       .get(topupUrl)
//       .then((response) => {
//         console.log(response.data);
//         if (
//           response.data.code == 100 &&
//           response.data.message == "Recharge successful"
//         ) {
//           new TopUpModel({
//             senderPhone: user.phone,
//             receiverPhone: phone,
//             amount: amount,
//             txref: txRef,
//             Network: service[network],
//             status: "success",
//           }).save();

//           new TxModel({
//             userId: userId,
//             txType: "Admintopup",
//             txAmount: amount,
//             txRef: txRef,
//             status: "success",
//           }).save();
//           res.status(200).json({ msg: "success" });
//         } else {
//           res.status(200).json(response.data);
//           new TopUpModel({
//             senderPhone: user.phone,
//             receiverPhone: phone,
//             amount: amount,
//             txref: txRef,
//             Network: service[network],
//             status: "Failed",
//           }).save();

//           new TxModel({
//             userId: userId,
//             txType: "Admintopup",
//             txAmount: amount,
//             txRef: txRef,
//             status: "Failed",
//           }).save();
//         }
//       })
//       .catch((error) => {
//         console.error("Error: " + error.message);
//       });
//   });
// });

// Route to get total top-up


app.get("/topupuser", async (req, res) => {
  const service = {
    15: "MTN VTU",
    6: "GLO",
    1: "Airtel",
    2: "9Mobile",
  };

  const { network, amount, phone, txRef, userId } = req.query;
  console.log(network, amount, phone, txRef);

  try {
    // Validate userId existence
    if (!userId) {
      return res.status(400).json({ msg: "userId parameter is required" });
    }

    // Fetch user information
    const user = await userModel.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const topupUrl = `https://mobileairtimeng.com/httpapi/?userid=${process.env.RECHARGE_API_PHONE}&pass=${process.env.RECHARGE_APIKEY}&network=${network}&phone=${phone}&amt=${amount}&user_ref=${txRef}&jsn=json`;

    console.log(process.env.RECHARGE_API_PHONE, process.env.RECHARGE_APIKEY);

    // Make API call to recharge service
    const response = await axios.get(topupUrl);
    console.log(response.data);

    // Handle response from recharge service
    if (response.data.code === 100 && response.data.message === "Recharge successful") {
      // Record successful top-up in TopUpModel and TxModel
      await Promise.all([
        new TopUpModel({
          senderPhone: user.phone,
          receiverPhone: phone,
          amount: amount,
          txref: txRef,
          Network: service[network],
          status: "success",
        }).save(),
        new TxModel({
          userId: userId,
          txType: "Admintopup",
          txAmount: amount,
          txRef: txRef,
          status: "success",
        }).save()
      ]);

      return res.status(200).json({ msg: "success" });
    } else {
      // Record failed top-up in TopUpModel and TxModel
      await Promise.all([
        new TopUpModel({
          senderPhone: user.phone,
          receiverPhone: phone,
          amount: amount,
          txref: txRef,
          Network: service[network],
          status: "Failed",
        }).save(),
        new TxModel({
          userId: userId,
          txType: "Admintopup",
          txAmount: amount,
          txRef: txRef,
          status: "Failed",
        }).save()
      ]);

      return res.status(200).json(response.data);
    }
  } catch (error) {
    console.error("Error: " + error.message);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
});



app.get("/AdminTotalTopupup", async (req, res) => {
  const { userId } = req.query;

  try {
    if (!userId) {
      return res.status(400).json({ msg: "userId parameter is required" });
    }

    // Find transactions where admin performed top-up for the user
    const adminTopUpTransactions = await TxModel.find({ userId: userId, txType: "Admintopup" });

    if (!adminTopUpTransactions || adminTopUpTransactions.length === 0) {
      return res.status(404).json({ msg: "No admin top-up transactions found for the user" });
    }

    res.status(200).json({ result: adminTopUpTransactions });
  } catch (error) {
    console.error("Error fetching admin top-up transactions:", error);
    res.status(500).json({ msg: "Internal Server Error", error: error.message });
  }
});

// app.get("/AdminTotalTopupup", (req, res) => {
//   const { userId } = req.query;

//   TxModel.find({ userId: userId, txType: "Admintopup" }).then((response) => {
//     res.status(200).json({ result: response });
//   });
// });


app.get("/TotalAdminFunds", async (req, res) => {
  const { userId } = req.query;

  try {
    if (!userId) {
      return res.status(400).json({ msg: "Missing userId parameter" });
    }

    // Find transactions where funds were administered by admin for the user
    const adminFundsTransactions = await TxModel.find({ userId: userId, txType: "Adminfunding" });

    if (!adminFundsTransactions || adminFundsTransactions.length === 0) {
      return res.status(404).json({ msg: "No admin funding transactions found for the user" });
    }

    res.status(200).json({ result: adminFundsTransactions });
  } catch (error) {
    console.error("Error fetching admin funds transactions:", error);
    res.status(500).json({ msg: "Internal Server Error", error: error.message });
  }
});

// app.get("/TotalAdminFunds", (req, res) => {
//   const { userId } = req.query;

//   TxModel.find({ userId: userId, txType: "Adminfunding" }).then((response) => {
//     res.status(200).json({ result: response });
//   });
// });

app.post("/Admin", async (req, res) => {
  const { name, email, phoneNumber, password, role } = req.body;
  const hashPassword = (password) => {
    return new Promise((resolve, reject) => {
      bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) reject(err);
        resolve(hash);
      });
    });
  };
  try {
    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create a new admin with hashed password
    const admin = await new AdminModel({
      name,
      email,
      phoneNumber,
      password: hashedPassword, // Save hashed password
      role,
    }).save();

    res.status(201).json(admin);
  } catch (error) {
    console.error("Error adding admin:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});   

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});

