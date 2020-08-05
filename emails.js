const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport(
    {
        service: "gmail",
        port: 465,
        secure: true,
        auth: {
            type: 'OAuth2',
            user: process.env.EMAIL_USER + '@gmail.com',
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            refreshToken: process.env.GOOGLE_REFRESH_TOKEN
        }
    }
);

module.exports =  {transporter};
