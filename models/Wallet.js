const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define Wallet Schema
const WalletSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User', //refers to the user modal
    required: true
  },
  balance: {
    type: Number,
    default: 0.00,
  },
 
  createdAt: {
    type: Date,
    default: Date.now(),
  }
});


// Create and export Wallet model
module.exports = mongoose.model('Wallet', WalletSchema);
