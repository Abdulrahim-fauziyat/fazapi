const mongoose = require('mongoose');
const { Schema } = mongoose;

const AdminTxSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Refers to the User model
    required: true,
  },
  txType: {
    type: String,
    enum: ['Adminfunding'], // Consider adding more types if needed
    required: true,
  },
  txAmount: {
    type: Number,
    required: true,
  },
  txRef: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String, // Changed to lowercase for consistency
    required: true,
  },
  status: {
    type: String,
    enum: ['Failed', 'InProgress', 'Success'],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now, // Use a function for dynamic default value
  }
});

module.exports = mongoose.model('AdminTx', AdminTxSchema);
