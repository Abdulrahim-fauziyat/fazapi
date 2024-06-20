const mongoose = require('mongoose');

const { Schema } = mongoose;

const UserSchema = new Schema({
    fullName:{
        type:String,
        required:true,
        length:80
    },
    phone:{
        type:String,
        required:true,
        length:15,
        unique:true,
    },
    email:{
        type:String,
        required:true,
        length:100,
        unique:true,
    },
    password:{
        required:true,
        type:String,
        length:8,
    },
    status:{
        type:Boolean,
        default:false,
    },
    createdAt:{
        type: Date,
        default:Date.now()
    }
})

module.exports = mongoose.model("User",UserSchema);