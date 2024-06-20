const mongoose = require('mongoose');
const { Schema } = mongoose;

const adminTopupSchema = new Schema({
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
    min: 0, // Example: Minimum value for the amount
  },
  txref: {
    type: String, // Changed to string for flexibility
    required: true,
  },
  network: { // Changed to lowercase for consistency
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Failed', 'InProgress', 'Success'],
    default: 'InProgress', // Example: Default value for status
    required: true,
  },
});

module.exports = mongoose.model('AdminTopup', adminTopupSchema);
