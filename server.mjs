

import express from 'express';
import path from 'path';
import cors from 'cors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { 
  stringToHash,
  varifyHash
} from "bcrypt-inzi"

const SECRET = process.env.SECRET || "topsecret";


const app = express()
const port = process.env.PORT || 5001
const mongodbURI = process.env.mongodbURI ||
   "mongodb+srv://saad:sdsdsd@cluster0.9bemtsg.mongodb.net/ecommerce?retryWrites=true&w=majority";


//working 
//"mongodb+srv://abcd:abcd@cluster0.oud3rz1.mongodb.net/abcd?retryWrites=true&w=majority"; 



//newdb
//"mongodb+srv://newdb:newdb@cluster0.oud3rz1.mongodb.net/newdb?retryWrites=true&w=majority";



// saad 
  // "mongodb+srv://saad:sdsdsd@cluster0.9bemtsg.mongodb.net/ecommerce?retryWrites=true&w=majority";



//"mongodb+srv://abcd:abcd@cluster0.oud3rz1.mongodb.net/abcd?retryWrites=true&w=majority"; 
// "mongodb+srv://abcd:abcd@cluster0.eu5uldj.mongodb.net/anas?retryWrites=true&w=majority";
//"mongodb+srv://EcommerceDB:EcommerceDB@cluster0.oud3rz1.mongodb.net/abcnet?retryWrites=true&w=majority";



app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: ['http://localhost:3000', "*"],
  credentials: true
}));


let productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: String,
  description: String,
  createdOn: { type: Date, default: Date.now }
});

const productModel = mongoose.model('products', productSchema);

const userSchema = new mongoose.Schema({

  firstName: { type: String },
  lastName: { type: String },
  email: { type: String, required: true },
  password: { type: String, required: true },

  age: { type: Number, min: 17, max: 65, default: 18 },
  isMarried: { type: Boolean, default: false },

  createdOn: { type: Date, default: Date.now },
});
const userModel = mongoose.model('Users', userSchema);






app.post("/signup", (req, res) => {

  let body = req.body;

  if (!body.firstName
      || !body.lastName
      || !body.email
      || !body.password
  ) {
      res.status(400).send(
          `required fields missing, request example: 
              {
                  "firstName": "John",
                  "lastName": "Doe",
                  "email": "abc@abc.com",
                  "password": "12345"
              }`
      );
      return;
  }


  req.body.email= req.body.email.toLowerCase();

  // check if user already exist // query email user
  userModel.findOne({ email: body.email }, (err, user) => {
      if (!err) {
          console.log("user: ", user);

          if (user) { // user already exist
              console.log("user already exist: ", user);
              res.status(400).send({ message: "user already exist,, please try a different email" });
              return;

          } else { // user not already exist

              stringToHash(body.password).then(hashString => {

                  userModel.create({
                      firstName: body.firstName,
                      lastName: body.lastName,
                      email: body.email,
                      password: hashString
                  },
                      (err, result) => {
                          if (!err) {
                              console.log("user saved: ", result);
                              res.status(201).send({ message: "user is created" });
                          } else {
                              console.log("db error: ", err);
                              res.status(500).send({ message: "internal server error" });
                          }
                      });
              })

          }
      } else {
          console.log("db error: ", err);
          res.status(500).send({ message: "db error in query" });
          return;
      }
  })
});

app.post("/login", (req, res) => {

  let body = req.body;
  body.email=body.email.toLowerCase();

  if (!body.email || !body.password) { // null check - undefined, "", 0 , false, null , NaN
      res.status(400).send(
          `required fields missing, request example: 
              {
                  "email": "abc@abc.com",
                  "password": "12345"
              }`
      );
      return;
  }

  // check if user already exist // query email user
  userModel.findOne(
      { email: body.email },
      "email firstName lastName password",
      (err, user) => {
          if (!err) {
              console.log("user: ", user);

              if (user) { // user found
                  varifyHash(body.password, user.password).then(isMatched => {

                      console.log("isMatched: ", isMatched);

                      if (isMatched) {

                          const token = jwt.sign({
                              _id: user._id,
                              email: user.email,
                              iat: Math.floor(Date.now() / 1000) - 30,
                              exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24),
                          }, SECRET);

                          // DONT CONSOLE TOKEN WHEN DEPLOYING FOR PRODUCTION LEVEL 
                          console.log("token: ", token);

                          res.cookie('Token', token, {
                              maxAge: 86_400_000,
                              httpOnly: true
                          });

                          res.send({
                              message: "login successful",
                              profile: {
                                  email: user.email,
                                  firstName: user.firstName,
                                  lastName: user.lastName,
                                  _id: user._id
                              }
                          });
                          return;
                      } else {
                          console.log("password did not match");
                          res.status(401).send({ message: "Incorrect email or password" });
                          return;
                      }
                  })

              } else { // user not already exist
                  console.log("user not found");
                  res.status(401).send({ message: "Incorrect email or password" });
                  return;
              }
          } else {
              console.log("db error: ", err);
              res.status(500).send({ message: "login failed, please try later" });
              return;
          }
      })



})

app.post("/logout", (req, res) => {

  res.cookie('Token', '', {
      maxAge: 1,
      httpOnly: true
  });

  res.send({ message: "Logout successful" });
})



app.use( (req, res, next) => {
  console.log("req.cookies: ", req.cookies);

  if (!req?.cookies?.Token) {
      res.status(401).send({
          message: "include http-only credentials with every request"
      })
      return;
  }
  jwt.verify(req.cookies.Token, SECRET, function (err, decodedData) {
      if (!err) {

          console.log("decodedData: ", decodedData);

          const nowDate = new Date().getTime() / 1000;

          if (decodedData.exp < nowDate) {
              res.status(401); 
              res.cookie('Token', '', {
                maxAge: 1,
                httpOnly: true
            });
              res.send( {message: "token expired"} )
          } else {

              console.log("token approved");

              req.body.token = decodedData
              next();
          }
      } else {
          res.status(401).send("invalid token")
      }
  });
})






app.post('/product', (req, res) => {

  const body = req.body;

  if (
    !body.name
    || !body.price
    || !body.description
  ) {
    res.status(400).send({ message: "required parameter failed" })
    return;
  }

  console.log(body.name)
  console.log(body.price)
  console.log(body.description)

  // products.push({
  //   id: ` ${new Date().getTime()}`,
  //   name: body.name,
  //   price: body.price,
  //   description: body.description
  // })


  productModel.create({
    name: body.name,
    price: body.price,
    description: body.description,
  },
    (err, saved) => {
      if (!err) {
        console.log(saved);

        res.send({
          message: "Product succesfully stored"
        })

      } else {
        res.status(500).send({
          message: "server error"
        })
      }
    })

})

app.get('/products', (req, res) => {

  productModel.find({}, (err, user) => {
    if (!err) {
      res.send({
        message: "Got all products Succesfully",
        user: user
      })
    } else {
      res.status(500).send({
        message: "server error"
      })
    }
  });


})

app.get('/product/:id', (req, res) => {

  const id = req.params.id;

  productModel.findOne({ _id: id }, (err, user) => {
    if (!err) {

      if (user) {
        res.send({
          message: `get product by id: ${user._id} success`,
          user: user
        });
      } else {
        res.status(404).send({
          message: "product not found",
        })
      }
    } else {
      res.status(500).send({
        message: "server error"
      })
    }
  });
})

app.delete('/product/:id', (req, res) => {

  const id = req.params.id;

  productModel.deleteOne({ _id: id }, (err, deletedData) => {
    console.log("deleted: ", deletedData);
    if (!err) {

      if (deletedData.deletedCount !== 0) {
        res.send({
          message: "Product has been deleted successfully",
        })
      } else {
        res.status(404);
        res.send({
          message: "No Product found with this id: " + id,
        });
      }
    } else {
      res.status(500).send({
        message: "server error"
      })
    }
  });
})

app.put('/product/:id', async (req, res) => {

  const body = req.body;
  const id = req.params.id;

  if (
    !body.name ||
    !body.price ||
    !body.description
  ) {
    res.status(400).send(` required parameter missing. example request body:
      {
          "name": "value",
          "price": "value",
          "description": "value"
      }`)
    return;
  }

  try {
    let user = await productModel.findByIdAndUpdate(id,
      {
        name: body.name,
        price: body.price,
        description: body.description
      },
      { new: true }
    ).exec();

    console.log('updated: ', user);

    res.send({
      message: "product modified successfully"
    });

  } catch (error) {
    res.status(500).send({
      message: "server error"
    })
  }
})



const __dirname = path.resolve();

app.use('/', express.static(path.join(__dirname, './web/build')))
app.use('*', express.static(path.join(__dirname, './web/build')))



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})



/////////////////////////////////////////////////////////////////////////////////////////////////
mongoose.connect(mongodbURI);

////////////////mongodb connected disconnected events///////////////////////////////////////////////
mongoose.connection.on('connected', function () {//connected
  console.log("Mongoose is connected");
});

mongoose.connection.on('disconnected', function () {//disconnected
  console.log("Mongoose is disconnected");
  process.exit(1);
});

mongoose.connection.on('error', function (err) {//any error
  console.log('Mongoose connection error: ', err);
  process.exit(1);
});

process.on('SIGINT', function () {/////this function will run jst before app is closing
  console.log("app is terminating");
  mongoose.connection.close(function () {
    console.log('Mongoose default connection closed');
    process.exit(0);
  });
});
////////////////mongodb connected disconnected events///////////////////////////////////////////////