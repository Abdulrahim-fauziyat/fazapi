const mongoose = require('mongoose'); 

const connectDb = async () =>{
    try{
        console.log( process.env.MONGO_URI );
        const conn= await mongoose.connect(process.env.MONGO_URI.toString());
            console.log(`Mongodb connected:${conn.connection.host}`);
     } catch (e){
        console.error(e.message);
     } 
}

module.exports= connectDb;