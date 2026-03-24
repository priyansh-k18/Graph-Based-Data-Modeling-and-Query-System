require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { chatWithData } = require('./llm');

const app = express();
app.use(cors());
app.use(express.json());

// Helper function to build the graph
app.get('/api/graph', (req, res) => {
    try {
        const nodes = [];
        const edges = [];

        // 1. Customers
        const customers = db.prepare('SELECT customer as id, businessPartnerName as label FROM business_partners LIMIT 50').all();
        customers.forEach(c => nodes.push({ id: `C_${c.id}`, type: 'customNode', data: { label: c.label, type: 'Customer' } }));

        // 2. Orders
        const orders = db.prepare('SELECT salesOrder as id, soldToParty FROM sales_order_headers').all();
        orders.forEach(o => {
            nodes.push({ id: `O_${o.id}`, type: 'customNode', data: { label: `Order ${o.id}`, type: 'Order' } });
            edges.push({ id: `e_c_${o.soldToParty}_o_${o.id}`, source: `C_${o.soldToParty}`, target: `O_${o.id}`, label: 'PLACED' });
        });

        // 3. Deliveries
        const deliveries = db.prepare('SELECT DISTINCT h.deliveryDocument as id, i.referenceSdDocument as salesOrder FROM outbound_delivery_headers h JOIN outbound_delivery_items i ON h.deliveryDocument = i.deliveryDocument').all();
        deliveries.forEach(d => {
            nodes.push({ id: `D_${d.id}`, type: 'customNode', data: { label: `Deliv ${d.id}`, type: 'Delivery' } });
            edges.push({ id: `e_o_${d.salesOrder}_d_${d.id}`, source: `O_${d.salesOrder}`, target: `D_${d.id}`, label: 'SHIPPED_AS' });
        });

        // 4. Invoices
        const invoices = db.prepare('SELECT DISTINCT h.billingDocument as id, i.referenceSdDocument as deliveryDocument FROM billing_document_headers h JOIN billing_document_items i ON h.billingDocument = i.billingDocument').all();
        invoices.forEach(i => {
            nodes.push({ id: `I_${i.id}`, type: 'customNode', data: { label: `Inv ${i.id}`, type: 'Invoice' } });
            edges.push({ id: `e_d_${i.deliveryDocument}_i_${i.id}`, source: `D_${i.deliveryDocument}`, target: `I_${i.id}`, label: 'BILLED_AS' });
        });

        // 5. Journal Entries
        const journals = db.prepare('SELECT accountingDocument as id, referenceDocument as billingDocument FROM journal_entry_items_accounts_receivable').all();
        journals.forEach(j => {
            nodes.push({ id: `J_${j.id}`, type: 'customNode', data: { label: `Journal ${j.id}`, type: 'Journal Entry' } });
            edges.push({ id: `e_i_${j.billingDocument}_j_${j.id}`, source: `I_${j.billingDocument}`, target: `J_${j.id}`, label: 'ACCOUNTED_IN' });
        });

        res.json({ nodes, edges });
    } catch (error) {
        console.error('Graph generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const response = await chatWithData(message, history);
        res.json(response);
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});

module.exports = app;
