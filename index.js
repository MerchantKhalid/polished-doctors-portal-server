const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt= require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express()

// middleware
app.use(cors())
app.use(express.json())


const uri =`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5aic8qc.mongodb.net/?retryWrites=true&w=majority` ;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req,res,next){
        const authHeader= req.headers.authorization;
        if(!authHeader){
            return res.status(401).send('unauthorized access')
        }
        const token= authHeader.split(' ')[1];
        jwt.verify(token,process.env.ACCESS_TOKEN,function(err,decoded){
            if(err){
                return res.status(403).send({message:'forbidden access'})
            }
            req.decoded=decoded
            next()
        })
}

async function run(){
    try{
        const appointmentOptionsCollection = client.db('polished-doctors-portal').collection('appointmentOptions');
        const bookingsCollection = client.db('polished-doctors-portal').collection('bookings');
        const usersCollection = client.db('polished-doctors-portal').collection('users');

        app.get('/appointmentoptions',async(req,res)=>{
            const date= req.query.date;
            const query ={};
            const options = await appointmentOptionsCollection.find(query).toArray();
            const bookingQuery= {appointmentDate:date}
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();
            options.forEach(option=>{
                const optionBooked=  alreadyBooked.filter(book=>book.treatment=== option.name)
                console.log(optionBooked)
                const bookedSlot= optionBooked.map(book=>book.slot)
                const remainingSlot=option.slots.filter(slot=>!bookedSlot.includes(slot))
                option.slots=remainingSlot;
            })
            res.send(options);
        });

        app.get('/bookings',verifyJWT,async(req,res)=>{
            const email= req.query.email;
            const decodedEmail= req.decoded.email;
            if(email!==decodedEmail){
                res.status(403).send({message:'forbidden access'})
            }
            const query= {email:email};
            const bookings= await bookingsCollection.find(query).toArray();
            res.send(bookings);
        })

        app.post('/bookings',async(req,res)=>{
            const booking= req.body;
            const query = {
                appointmentDate: booking.appointmentDate,
                email:booking.email,
                treatment:booking.treatment
            }
            const alreadyBooked= await bookingsCollection.find(query).toArray()
            if(alreadyBooked.length){
                const message =`You already have an appointment on ${booking.appointmentDate}`
                return res.send({acknowledged:false,message})
            }

            const result = await bookingsCollection.insertOne(booking);
            res.send(result) 
        });

        app.get('/jwt',async(req,res)=>{
            const email= req.query.email;
            const query={email:email};
            const user= await usersCollection.findOne(query);
            if(user){
                const token = jwt.sign({email},process.env.ACCESS_TOKEN)
                return res.send({accessToken:token});
            }
            res.status(403).send({accessToken:''})
        })

        app.get('/users/admin/:email',async(req,res)=>{
            const email= req.params.email;
            const query= {email}
            const user= await usersCollection.findOne(query)
            res.send({isAdmin:user?.role==='admin'})
        })

        app.get('/users',async(req,res)=>{
            const query={};
            const users = await usersCollection.find(query).toArray();
            res.send(users)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log(user);
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        app.put('/users/admin/:id',verifyJWT,async(req,res)=>{
            const decodedEmail=req.decoded.email;
            const query={email:decodedEmail};
            const user = await usersCollection.findOne(query);
            if(user.role!=='admin'){
                return res.status(403).send({message:'forbidden access'})
            } 
            const id = req.params.id;
            const filter={_id:ObjectId(id)};
            const options={upsert:true}
            const updatedDoc={
                $set:{
                    role:'admin'
                }
            }
            const result= await usersCollection.updateOne(filter,updatedDoc,options);
            res.send(result);
        })

        
    }
    finally{

    }
}
run().catch(console.log)


app.get('/',async(req,res)=>{
    res.send('Doctors server is running')
})

app.listen(port,()=>console.log(`Doctors Server running on ${port}`))