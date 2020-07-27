const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport(
    {
        service: "gmail",
        auth: {
            user: "peer2peercharlotte",
            pass: "fPrh5692"
        }
    }
);

module.exports =  {transporter};
