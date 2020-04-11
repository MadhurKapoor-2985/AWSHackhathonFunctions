'use-strict'

const sql = require('mssql')
const uuidv4 = require('uuid/v4');
var AWS = require('aws-sdk');
const axios = require('axios')


exports.handler = async (event) => {
    
    console.log("triggered from queue")
    let customerId
    console.log ('Event is, ', event)
    openApiUrl = process.env.OPEN_API_URL

    if(event.Records === undefined) {
        customerId = event.customerId
    }
    else {
        console.log('Event Records message attributes is', event.Records[0].messageAttributes)
        customerId = event.Records[0].messageAttributes.CustomerId['stringValue']
    }
    console.log("Customer Id from queue ", customerId)

    let existingCardTypeId, proposedCardTypeId, Email

     const config = {
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        database: process.env.DB_DATABASE,
        options: {
            encrypt: true // Use this if you're on Windows Azure
        }
    }

    try {
        // Open DB Connection
        let pool = await sql.connect(config)

        result = await pool.request()
            .input('lookupValue', sql.NVarChar, customerId)
            .query('select * from TempUserInfo where CustomerId = @lookupValue')

        if(result.recordset[0] != undefined) {
            pool.close()
            return {
                statusCode: 400,
                body: "Record already processed"
            }
        }

        result = await pool.request()
            .input('lookupValue', sql.NVarChar, customerId)
            .query('select CustomerCardInfo.*, UserInfo.Email, UserInfo.City, UserInfo.PhoneNumber from CustomerCardInfo inner join UserInfo on CustomerCardInfo.CustomerId = UserInfo.CustomerId where CustomerCardInfo.CustomerId = @lookupValue order by CardTypeId desc')

        console.log("Getting CardType Details ", result)
        
        if(result.recordset[0] === undefined) {
            pool.close()
            return {
                statusCode: 404,
                body: "Not an existing Credit Card Holder"
            }
        }

        existingCardTypeId = result.recordset[0].CardTypeId
        existingCreditLimit = result.recordset[0].CreditLimit
        Email = result.recordset[0].Email
        City = result.recordset[0].City
        DeviceLocation = process.env.LOCATION
        PhoneNumber = result.recordset[0].PhoneNumber

        console.log('Existing card type id is ', existingCardTypeId)
        finalUrl = openApiUrl + '?phoneNumber=' + PhoneNumber

        await axios.get(finalUrl)
        .then(data => {

            console.log('Got data from Open API', data.data)

            creditLimitarray = data.data.body.CreditLimit


            creditLimitarray.forEach(function(limit) {
                if(limit > existingCreditLimit) {
                    existingCreditLimit = limit
                }
             });

        })
        .catch(error => {
            console.log(error)
            pool.close()
            return {
                statusCode: 400,
                body: "Some Error occured"
            }
        })

        console.log('Existing credit limit to check after OpenAPI ', existingCreditLimit)

        result = await pool.request()
            .input('lookupValue', sql.NVarChar, existingCreditLimit)
            .query('select * from CardTypes where CreditLimit > @lookupValue order by CardTypeId')

        console.log("Valid Card Type id ", result)

        if(result.recordset[0] === undefined) {
            pool.close()
            return {
                status: 400,
                body: "No Upgrade available at the moment"
            }
        }

        proposedCardTypeId = result.recordset[0].CardTypeId

        var lattitude  = process.env.LATTITUDE
        var longitude = process.env.LONGITUDE

        const guid = uuidv4()

        console.log("Generated guid is ", guid)

        result = await pool.request()
           .input('customerId', sql.NVarChar, customerId)
           .input('guid', sql.NVarChar, guid)
           .input('existingCardTypeId', sql.Numeric, existingCardTypeId)
           .input('proposedCardTypeId', sql.Numeric, proposedCardTypeId)
           .input('lattitude', sql.Float, lattitude)
           .input('longitude', sql.Float, longitude)
           .input('customerEmail', sql.NVarChar, Email)
           .input('deviceLocation', sql.NVarChar, DeviceLocation)
           .input('city', sql.NVarChar, City)
           .query('Insert into TempUserInfo(Guid, CustomerId, ExistingCardId, ProposedCardId, Lattitude, Longitude, CustomerEmail, DeviceLocation, CustomerBaseLocation) values(@guid, @customerId, @existingCardTypeId, @proposedCardTypeId, @lattitude, @longitude, @customerEmail, @deviceLocation, @city)')

        console.log(result)

        pool.close()

        const payLoad = {
            CustomerEmail: Email,
            CustomerGuid: guid,
            MessageType: '1'
        }

// Set region
        AWS.config.update({region: 'us-west-2'});

// Create publish parameters
        var params = {
        Message: JSON.stringify(payLoad), /* required */
        TopicArn: process.env.SNS_ARN
        };

        // Create promise and SNS service object
        var publishTextPromise = await new AWS.SNS({apiVersion: '2010-03-31'}).publish(params).promise();

    }
    catch(err)
    {
        //pool.close()
        console.log("An error occured", err)
        return {
            statusCode: 500,
            body: "An error occured"
        }
    }

    const response = {
        statusCode: 200,
        body: JSON.stringify('Data successfully processed'),
    };
    return response;
};
