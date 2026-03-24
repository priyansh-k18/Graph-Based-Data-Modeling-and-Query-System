const Groq = require('groq-sdk');
const db = require('./db');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || 'no_key_provided'
});

const SCHEMA = `
You are a context graph AI agent answering questions about an Order-to-Cash dataset.
If the question is unrelated to the dataset or domain (e.g. general knowledge, poem, coding besides this), reply exactly with: 
{"sql": null, "rejection": "This system is designed to answer questions related to the provided dataset only."}

Available SQLite Tables (and their key columns):
1. business_partners: businessPartner, businessPartnerName, customer
2. sales_order_headers: salesOrder, salesOrganization, soldToParty, totalNetAmount, transactionCurrency
3. sales_order_items: salesOrder, salesOrderItem, material, netAmount
4. products: product, productGroup, netWeight
5. product_descriptions: product, productDescription
6. outbound_delivery_headers: deliveryDocument, creationDate
7. outbound_delivery_items: deliveryDocument, deliveryDocumentItem, referenceSdDocument (links to salesOrder), plant
8. billing_document_headers: billingDocument, billingDocumentDate, totalNetAmount, cancelledBillingDocument
9. billing_document_items: billingDocument, billingDocumentItem, referenceSdDocument (links to deliveryDocument), material, netAmount
10. journal_entry_items_accounts_receivable: accountingDocument, referenceDocument (links to billingDocument), amountInTransactionCurrency
11. payments_accounts_receivable: accountingDocument, clearingAccountingDocument, amountInTransactionCurrency, customer

Foreign Keys / Relationships:
- A customer (business_partners.customer) places an order (sales_order_headers.soldToParty)
- An order (sales_order_headers) has items (sales_order_items.salesOrder)
- A delivery (outbound_delivery_items) references an order (referenceSdDocument = salesOrder)
- A billing document/invoice (billing_document_items) references a delivery (referenceSdDocument = deliveryDocument)
- A journal entry (journal_entry_items_accounts_receivable) references a billing document (referenceDocument = billingDocument)
- A product description links to products on 'product' column.

RULES:
1. Provide exactly ONE single SELECT SQL statement. Do not combine multiple queries.
2. Do NOT hallucinate filters. If asked for "all customers", do not add 'WHERE customer = X'. Just select the rows.
3. You MUST respond strictly in valid JSON format.

Example for off-topic:
{
  "sql": null,
  "rejection": "This system is designed to answer questions related to the provided dataset only."
}
Example for valid request:
{
  "sql": "SELECT billingDocument, totalNetAmount FROM billing_document_headers ORDER BY totalNetAmount DESC LIMIT 5;"
}
`;

async function chatWithData(message, history = []) {
    try {
        if (groq.apiKey === 'no_key_provided') {
            return { answer: "Error: No GROQ_API_KEY provided in .env file.", guardrail: true };
        }

        // --- Step 1: SQL Generation & Guardrail ---
        const sysMsg = { role: "system", content: SCHEMA };
        const userMsg = { role: "user", content: message };
        
        const sqlGenResponse = await groq.chat.completions.create({
            messages: [sysMsg, ...history, userMsg],
            model: "llama-3.3-70b-versatile",
            temperature: 0,
            response_format: { type: "json_object" }
        });

        const jObj = JSON.parse(sqlGenResponse.choices[0].message.content);
        
        if (jObj.rejection) {
            return { answer: jObj.rejection, guardrail: true };
        }

        if (!jObj.sql) {
            return { answer: "I couldn't formulate a data query for your question.", guardrail: true };
        }

        const sqlQuery = jObj.sql;
        console.log("Generated SQL:", sqlQuery);

        // --- Step 2: Execution ---
        let queryResult;
        try {
            // Read-only safety guard since better-sqlite3 doesn't have a strict readonly connection without extra setup
            if (!sqlQuery.trim().toUpperCase().startsWith('SELECT')) {
                throw new Error('Only SELECT queries are allowed.');
            }
            queryResult = db.prepare(sqlQuery).all();
        } catch (dbError) {
            console.error("SQL Execution Error:", dbError.message);
            // If SQL fails, ask LLM to explain the error or fail gracefully
            return { answer: `I encountered an error querying the dataset: ${dbError.message}`, sql: sqlQuery, error: true };
        }

        // --- Step 3: Synthesis ---
        // Convert result to JSON string. Limit size if massive.
        const dataStr = JSON.stringify(queryResult).substring(0, 15000); 

        const synthPrompt = `
You are the final step in a data query pipeline. 
Original Question: ${message}
SQL Used: ${sqlQuery}
Data Result: ${dataStr}

Provide a natural language answer grounded ONLY in the data result. Do not mention SQLite or JSON, just synthesize the answer clearly for the user. If the data result is empty, say no data was found.
`;
        
        const synthResponse = await groq.chat.completions.create({
            messages: [{ role: "system", content: synthPrompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.2
        });

        return {
            answer: synthResponse.choices[0].message.content,
            sql: sqlQuery,
            data: queryResult
        };

    } catch (error) {
        console.error("LLM Pipeline error:", error);
        return { answer: "An error occurred while communicating with the AI.", error: true };
    }
}

module.exports = { chatWithData };
