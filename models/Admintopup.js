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
    min: 0, 
  },
  txref: {
    type: String,
    required: true,
  },
  network: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Failed', 'InProgress', 'Success'], 
    default: 'InProgress',
    required: true,
  },
});

module.exports = mongoose.model('AdminTopup', adminTopupSchema);
