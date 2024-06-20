const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define User Schema
const TopupSchema = new Schema({
  
   senderPhone: {
    type: String,
    required: true,
    
  },

  receiverPhone: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
   
  },
   txref: {

      type: Number,
      required: true
    },
   Network: {

      type: String,
      required: true
    },
   
    status: {
      type: String,
      enum:['Failed','InProgress','Success'],
      required: true,
    },
 
   
  
});

// Create and export User model
module.exports = mongoose.model('Topup', TopupSchema);
