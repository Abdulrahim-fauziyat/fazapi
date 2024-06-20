const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define User Schema
const FundSchema = new Schema({
  
   userId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User', //refers to the user model
  },

  amount: {
    type: Number,
    required: true, 
  },
   txref: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum:['Failed','Success'],
      required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now(),
      }
});

// Create and export User model
module.exports = mongoose.model('Fund', FundSchema);
