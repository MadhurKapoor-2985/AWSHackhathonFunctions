'use-strict'

const sql = require('mssql')
const uuidv4 = require('uuid/v4');

exports.handler = async (event) => {
    
    console.log("triggered from queue")
    console.log("Customer Id from queue ", event.Records[0].messageAttributes.CustomerId['stringValue'])

    let customerId = event.Records[0].messageAttributes.CustomerId['stringValue']
    //let customerId = event.customerId

    console.log("Customer id is ", customerId)

    let existingCardTypeId, proposedCardTypeId

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
            .query('select * from CustomerCardInfo where CustomerId = @lookupValue order by CardTypeId desc')

        console.log("Getting CardType Details ", result)
        
        if(result.recordset[0] === undefined) {
            pool.close()
            return {
                statusCode: 404,
                body: "Not an existing Credit Card Holder"
            }
        }

        existingCardTypeId = result.recordset[0].CardTypeId

        console.log('Existing card type id is ', existingCardTypeId)

        result = await pool.request()
            .input('lookupValue', sql.NVarChar, existingCardTypeId)
            .query('select * from CardTypes where CardTypeId > @lookupValue order by CardTypeId')

        console.log("Valid Card Type id ", result)

        if(result.recordset[0] === undefined) {
            pool.close()
            return {
                status: 400,
                body: "No Upgrade available at the moment"
            }
        }

        proposedCardTypeId = result.recordset[0].CardTypeId

        

        const guid = uuidv4()

        console.log("Generated guid is ", guid)

        result = await pool.request()
           .input('customerId', sql.NVarChar, customerId)
           .input('guid', sql.NVarChar, guid)
           .input('existingCardTypeId', sql.Numeric, existingCardTypeId)
           .input('proposedCardTypeId', sql.Numeric, proposedCardTypeId)
           .query('Insert into TempUserInfo(Guid, CustomerId, ExistingCardId, ProposedCardId) values(@guid, @customerId, @existingCardTypeId, @proposedCardTypeId)')

        console.log(result)

        pool.close()






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




    // TODO implement
    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    return response;
};
