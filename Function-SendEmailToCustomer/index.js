var aws = require('aws-sdk');
var ses = new aws.SES({region: 'us-west-2'});

exports.handler = async (event) => {
    
    console.log("Triggered from SNS topic")
    console.log("Event object is ,", event)
    console.log("sns object is ", event.Records[0].Sns)
    
    const parsedMessage = JSON.parse(event.Records[0].Sns.Message)
    
    let email = parsedMessage.CustomerEmail
    let guid = parsedMessage.CustomerGuid
    let messageType = parsedMessage.MessageType
    
    let emailContent = '', emailSubject = ''
    
    console.log("Email is, ", email)
    console.log("Message Type is, ", messageType)
    
    if(messageType == '1' ) {
    
        let url = process.env.APP_URL + 'CreditCard' + '?id=' + guid
        
        emailContent = `You are being offered a new credit card. Please click on ${url} to proceed `
        emailSubject = 'New Credit Card Offered'
    }
    
    if(messageType == '2') {
        let Voucher = parsedMessage.Voucher
        let CafeName = parsedMessage.CafeName
        let CafeAddress = parsedMessage.CafeAddress
        let gmapLink = parsedMessage.MapLink
        
        emailSubject = `Here is a voucher to enjoy you favorite beverage at ${CafeName}`
        emailContent = `Dear Customer, \n We are pleased to offer you a voucher to enjoy your favorite beverage at ${CafeName}. Please find the details below`;
        emailContent = emailContent + `\n Voucher Code = ${Voucher} \n Address = ${CafeAddress} \n Get Directions = ${gmapLink}  `
    }
    
    var params = {
        Destination: {
            ToAddresses: [email]
        },
        Message: {
            Body: {
                Text: { Data: emailContent
                    
                }
                
            },
            
            Subject: { Data: emailSubject
                
            }
        },
        Source: "admin@www.codingparadox.com"
    };

    const resp = await ses.sendEmail(params).promise();
    
    console.log(resp)

    // TODO implement
    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    return response;
};
