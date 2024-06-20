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
const AdminTxModel = require("./models/AdminTx.js");
const AdminWallet = require("./models/AdminWallet.js");
const AdminTopUpModel = require("./models/Admintopup.js");
const AdminModel = require("./models/AdminModel.js");
const userModel = require("./models/UserModel.js");

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
      return res.status(500).json({ error: "Error hashing password", details: err });
    }

    const newUser = new userModel({ fullName, phone, email, password: hash });

    newUser.save()
      .then((user) => {
        const newWallet = new userWallet({ userId: user._id });

        newWallet.save()
          .then((wallet) => {
            res.status(200).json({
              msg: "success",
              user,
              wallet,
            });
          })
          .catch((walletError) => {
            res.status(500).json({ error: "Error creating wallet", details: walletError });
          });
      })
      .catch((userError) => {
        res.status(500).json({ error: "Error saving user", details: userError });
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
  const TopUpModel = require("./models/Topup.js");
  const TxModel = require("./models/transactionModel.js");
  const userModel = require("./models/UserModel.js");
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
            status: "Success",
          }).save();

          new TxModel({
            userId: userId,
            txType: "topup",
            txAmount: amount,
            txRef: txRef,
            status: "Success",
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
// Admin fund user account
app.put("/funduser", async (req, res) => {
  const { amount, email, txId } = req.body;
  const userModel = require("./models/UserModel.js");
  const TxModel = require("./models/transactionModel.js");
  const AdminTxModel = require("./models/AdminTx.js"); 
  const WalletModel = require("./models/Wallet.js");
  const AdminWallet = require("./models/AdminWallet.js"); 

  const flw = new Flutterwave(process.env.FLW_PUB_KEY, process.env.FLW_SEC_KEY);
  const payload = { id: txId };

  try {
    // Verify transaction with Flutterwave
    const resData = await flw.Transaction.verify(payload);

    if (resData.data.status == "successful") {
      // Find user by email
      const user = await userModel.findOne({ email: email });
      if (!user) {
        return res.status(404).json({ msg: "User not found" });
      }

      const userId = user._id;

      // Update user wallet balance
      const updatedWallet = await WalletModel.findOneAndUpdate(
        { userId: userId },
        { $inc: { balance: Number(amount) } },
        { new: true }
      );

      // Update admin wallet balance
      const updatedAdminWallet = await AdminWallet.findOneAndUpdate(
        { userId: userId },
        { $inc: { balance: Number(amount) } },
        { new: true }
      );

      if (updatedWallet) {
        // Record the transaction
        await new TxModel({
          email: email,
          userId: userId,
          txType: "funding",
          txAmount: amount,
          txRef: txId,
          status: "Success",
        }).save();

        return res.status(200).json({ msg: updatedWallet, mystatus: "Success" });
      } 

      if (updatedAdminWallet) {
        // Record the admin transaction
        await new AdminTxModel({
          email: email,
          userId: userId,
          txType: "AdminFunding",
          txAmount: amount,
          txRef: txId,
          status: "Success",
        }).save();

        return res.status(200).json({ msg: updatedAdminWallet, mystatus: "Success" });
      } 

      return res.status(500).json({ msg: "Failed to update wallet balance" });
    } else {
      return res.status(400).json({ msg: "Transaction verification failed", data: resData });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Internal server error" });
  }
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

app.get("/Adtopup", (req, res) => {
  const AdminTopUpModel = require("./models/Admintopup.js");
  const AdminTxModel = require("./models/AdminTx.js");
  const userModel = require("./models/UserModel.js");
  const service = {
    15: "MTN VTU",
    6: "GLO",
    1: "Airtel",
    2: "9Mobile",
  };

  const { network, amount, phone, txRef, userId } = req.query;
  console.log(network, amount, phone, txRef);

  userModel.findOne({ _id: userId }).then((user) => {
    const AdtopupUrl = `https://mobileairtimeng.com/httpapi/?userid=${process.env.RECHARGE_API_PHONE}&pass=${process.env.RECHARGE_APIKEY}&network=${network}&phone=${phone}&amt=${amount}&user_ref=${txRef}&jsn=json`;

    console.log(process.env.RECHARGE_API_PHONE, process.env.RECHARGE_APIKEY);

    axios
      .get(AdtopupUrl)
      .then((response) => {
        console.log(response.data);
        if (
          (response.data.code == 100 &&
            response.data.message == "Recharge successful") ||
          2000
        ) {
          new AdminTopUpModel({
            senderPhone: user.phone,
            receiverPhone: phone,
            amount: amount,
            txref: txRef,
            Network: service[network],
            status: "Success",
          }).save();

          new AdminTxModel({
            userId: userId,
            txType: "Admintopup",
            txAmount: amount,
            txRef: txRef,
            status: "Success",
          }).save();
          res.status(200).json({ msg: "success" });
        } else {
          res.status(200).json(response.data);

          new AdminTopUpModel({
            senderPhone: user.phone,
            receiverPhone: phone,
            amount: amount,
            txref: txRef,
            Network: service[network],
            status: "Failed",
          }).save();

          new AdminTxModel({
            userId: userId,
            txType: "Admintopup",
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


// Route to get wallet balance
app.get('/balance', (req, res) => {
   axios.get('https://mobileairtimeng.com/httpapi/balance?userid=08139240318&pass=1bfa9b0533e929b4c4279&jsn=json')
   .then( response =>{
    console.log(response.data);
    if(!response.data.code) return res.status(400).json(response.data);
    res.status(200).json(response.data);
   }).catch( er => console.log(er) ) 
 
});

// Route to get total top-up
app.get("/AdminTotalTopupup", (req, res) => {
  const { userId } = req.query;

  AdminTxModel.find({ userId: userId, txType: "Admintopup" })
    .then((response) => {
      res.status(200).json({ result: response });
    })
    .catch((err) => {
      console.error("Error fetching total top-up:", err);
      res.status(500).json({ error: "An error occurred while fetching total top-up." });
    });
});

// Admin fund user account
app.put("/funduser", async (req, res) => {
  const { amount, email, txId} = req.body;

  try {
    // Find user by email
    const user = await userModel.findOne({ email: email });

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const userId = user._id;

    // Find the admin user by role
    const adminUser = await AdminModel.findOne({
      $or: [{ role: 'admin' }, { role: 'superadmin' }]
    });

    if (!adminUser) {
      return res.status(500).json({ msg: "Admin user not found" });
    }

    const adminUserId = adminUser._id;

    const flw = new Flutterwave(process.env.FLW_PUB_KEY, process.env.FLW_SEC_KEY);
    const payload = { id: txId };

    // Verify transaction with Flutterwave
    const resData = await flw.Transaction.verify(payload);

    if (resData.data.status === "successful") {
      // Update user wallet balance
      const updatedUserWallet = await WalletModel.findOneAndUpdate(
        { userId: userId },
        { $inc: { balance: Number(amount) } },
        { new: true }
      );

      // Update admin wallet balance
      const updatedAdminWallet = await AdminWallet.findOneAndUpdate(
        { userId: adminUserId },
        { $inc: { balance: Number(amount) } },
        { new: true }
      );

      if (updatedUserWallet && updatedAdminWallet) {
        // Record the transaction in user transaction history
        await new TxModel({
          email: email,
          userId: userId,
          txType: "funding",
          txAmount: amount,
          txRef: txId,
          txId: txId,
          status: "Success",
        }).save();

        // Record the transaction in admin transaction history
        await new AdminTxModel({
          userId: adminUserId,
          txType: "Adminfunding",
          txAmount: amount,
          txRef: txId,
          status: "Success",
        }).save();

        return res.status(200).json({
          userWallet: updatedUserWallet,
          adminWallet: updatedAdminWallet,
          status: "Success"
        });
      } else {
        return res.status(500).json({ msg: "Failed to update wallet balances" });
      }
    } else {
      return res.status(400).json({ msg: "Transaction verification failed", data: resData });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Internal server error", error: error.message });
  }
});



app.post("/Admin", async (req, res) => {
  const AdminModel = require("./models/AdminModel.js");
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

// GET route to fetch all admins
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
        AdminModel
          .findByIdAndUpdate(id, { password: hash })
          .then(() => res.json({ status: "success" })) // No need to send user data back, just status
          .catch((err) => res.json({ status: err.message })); // Sending error message
      })
      .catch((err) => res.json({ status: err.message }));
  }
});
      
app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});

//nodemon means node monitor to run that index.js or to monitor changes in the database
//CRUD operation MEANS CREATE READ UPDATE DELETE
// endpoint is an individual resource
//an API can contain many endpoints
