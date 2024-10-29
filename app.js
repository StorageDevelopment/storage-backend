const express = require("express");
const app = express();
const dbPassword = process.env.DBPASSWORD || "fakepassword";
const port = process.env.PORT || 3001;
const emailPassword = process.env.EMAILPASSWORD || "fakepassword";
const { MongoClient, ServerApiVersion } = require("mongodb");
const nodemailer = require('nodemailer');
const soapAsPromised = require('soap-as-promised');


app.use(express.json());

//const client = require("./mongodb.js");
const uri = `mongodb+srv://alanpurugganan:${dbPassword}@mystoragecluster.ajez3.mongodb.net/?retryWrites=true&w=majority&appName=MyStorageCluster`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (e) {
    console.log(`ERROR: Cannot connect to the database ${e}`);
  } finally {
    //await client.close();
  }
}
run().catch(console.dir);

app.post("/", async (req, res, next) => {
  const db = client.db("my_storage");

  const users = db.collection("users");
  
  //get the first toolCall
  const toolCall = req.body.message.toolCalls[0];

  //log the tool call list for examination
  console.log("toolCalls:" + JSON.stringify(toolCall));


  //get the toolname
  const toolName = toolCall.function.name;

  let result;

  if (toolName === "makePayment") {
    //get the name
    const name = toolCall.function.arguments.makePaymentName;

    //get the amount
    const payAmt = parseFloat(toolCall.function.arguments.makePaymentAmount);

    const userDoc = await users.findOne({
      name: name,
    });

    //get the current balance
    let balance = userDoc.balance;

    balance = Math.max(0, balance - payAmt);

    //update the document
    const filter = { name: name };

    await users.updateOne(filter, { $set: { balance: balance } });

    result = { newBalance: balance };
  } else if (toolName === "setInvoice") {
    //get the name
    const name = toolCall.function.arguments.setInvoiceName;

    //get the amount
    const newBalance = parseFloat(toolCall.function.arguments.setInvoiceAmount);

    //update the document
    const filter = { name: name };

    const options = { upsert: true };

    await users.updateOne(
      filter,
      { $set: { name: name, balance: newBalance } },
      options
    );

    result = { newBalance: newBalance };
  } else if (toolName === "getBalance") {
    //get the name
    const name = toolCall.function.arguments.getBalanceName;

    const userDoc = await users.findOne({
      name: name,
    });

    result = { currentBalance: userDoc.balance };
  } else if (toolName === "sendEmail") {

    const emailAddy = toolCall.function.arguments.emailAddy;
    const emailSubject = toolCall.function.arguments.emailSubject;
    const emailBody = toolCall.function.arguments.emailBody;

    

    var transporter = nodemailer.createTransport({
      service: 'yahoo',
      auth: {
        user: 'alan.purugganan@yahoo.com',
        pass: emailPassword
      }
    });

    var mailOptions = {
      from: 'alan.purugganan@yahoo.com',
      to: `${emailAddy}`,
      subject: `${emailSubject}`,
      text: `${emailBody}`
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });

    result = { message: "email sent successfully" };


  } else if (toolName === "testApi") {

    const url = 'https://api.smdservers.net/CCWs_3.5/CallCenterWs.asmx?WSDL';
    try{
      
      const client = await soapAsPromised.createClientAsync(url);
      const args = {
        sCorpCode : "CCTST",
        sLocationCode : "Demo",
        sCorpUserName : "Administrator:::MYSTORAGKF8O89FYPI9F",
        sCorpPassword : "Demo",
        lngLastTimePolled : 0
      };

      const soapResult = await client.UnitsInformation_v2Async(args);

      const x = JSON.stringify(soapResult);


      res.send(soapResult);

      next();
      return;

    }catch(e){
      console.error(JSON.stringify(e));
    }
  
 



    


  }

  //get tool call id
  const callId = toolCall.id;
  const responseObj = {
    results: [
      {
        toolCallId: callId,
        result: result,
      },
    ],
  };

  res.send(responseObj);
});

const server = app.listen(port, () =>
  console.log(`Example app listening on port ${port}!`)
);

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
