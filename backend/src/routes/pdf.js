const express = require('express');
const router = express.Router();
const PdfPrinter = require('pdfmake');
const db = require('../db/knex');
const { authenticateToken } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

// Use standard PDF Helvetica fonts to remove system file path dependencies
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
    bolditalic: 'Helvetica-BoldOblique'
  }
};

const printer = new PdfPrinter(fonts);

// Helper function to return the aligned footer logo and title on a single line
const getFooterLogo = () => ({
  margin: [0, 30, 0, 0],
  alignment: 'center',
  columns: [
    { width: '*', text: '' },
    {
      width: 'auto',
      table: {
        widths: [24],
        body: [
          [
            {
              text: 'TT',
              color: 'white',
              fillColor: '#4f46e5',
              alignment: 'center',
              bold: true,
              fontSize: 10,
              margin: [0, 3, 0, 3]
            }
          ]
        ]
      },
      layout: 'noBorders'
    },
    {
      width: 'auto',
      text: 'Thread Track',
      fontSize: 11,
      bold: true,
      color: '#334155',
      margin: [8, 4, 0, 0]
    },
    { width: '*', text: '' }
  ]
});

// All PDF routes require authentication
router.use(authenticateToken);

// Helper to format date
const formatDate = (dateStr) => {
  if (!dateStr) return 'Pending';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Helper to format currency
const formatCurrency = (val) => {
  return 'Rs. ' + parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// @route   GET /api/pdf/job-work-slip/:historyId
// @desc    Generate Job Work Slip when sending saree to vendor
router.get('/job-work-slip/:historyId', async (req, res) => {
  const historyId = req.params.historyId;

  try {
    const history = await db('workflow_history as h')
      .join('sarees as s', 'h.saree_id', 's.saree_id')
      .join('vendors as v', 'h.vendor_id', 'v.vendor_id')
      .select('h.*', 's.lot_number', 's.design_name', 's.quantity', 'v.vendor_name', 'v.vendor_type', 'v.mobile', 'v.address')
      .where('h.history_id', historyId)
      .first();

    if (!history) {
      return res.status(404).json({ error: 'Job work history record not found' });
    }

    const docDefinition = {
      content: [
        { text: req.user.name.toUpperCase(), style: 'header', alignment: 'center' },
        { text: 'JOB WORK SLIP', style: 'title', alignment: 'center', margin: [0, 10, 0, 20] },

        {
          columns: [
            [
              { text: `Vendor Name: ${history.vendor_name}`, style: 'boldText' },
              { text: `Vendor Type: ${history.vendor_type}` },
              { text: `Mobile: ${history.mobile}` },
              { text: `Address: ${history.address || 'N/A'}` }
            ],
            [
              { text: `Slip No: JWS-${history.history_id}`, style: 'boldText', alignment: 'right' },
              { text: `Sent Date: ${formatDate(history.sent_date)}`, alignment: 'right' },
              { text: `Status: PENDING WORK`, color: 'red', alignment: 'right', style: 'boldText' }
            ]
          ]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }], margin: [0, 10, 0, 15] },

        { text: 'SAREE LOT DETAILS', style: 'sectionHeader', margin: [0, 5, 0, 10] },
        {
          table: {
            widths: ['*', '*', '*', '*'],
            body: [
              [
                { text: 'Lot Number', style: 'tableHeader' },
                { text: 'Design Name', style: 'tableHeader' },
                { text: 'Quantity', style: 'tableHeader' },
                { text: 'Stage Name', style: 'tableHeader' }
              ],
              [
                history.lot_number.toString(),
                history.design_name,
                history.quantity.toString(),
                history.stage_name
              ]
            ]
          },
          layout: 'lightHorizontalLines'
        },
        { margin: [0, 15, 0, 15], text: '' },
        {
          columns: [
            { text: `Work Rate/Cost: ${formatCurrency(history.work_cost)}`, style: 'boldText' },
            { text: `Remarks: ${history.remarks || 'None'}` }
          ]
        },

        { text: '\n\n\n\n' },
        {
          columns: [
            { text: '___________________\nManager Signature', alignment: 'left' },
            { text: '___________________\nVendor Signature', alignment: 'right' }
          ]
        },
        getFooterLogo()
      ],
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 11,
        lineHeight: 1.4
      },
      styles: {
        header: {
          fontSize: 18,
          bold: true
        },
        subheader: {
          fontSize: 10,
          color: 'gray'
        },
        title: {
          fontSize: 14,
          bold: true,
          decoration: 'underline'
        },
        sectionHeader: {
          fontSize: 12,
          bold: true
        },
        tableHeader: {
          bold: true,
          fillColor: '#EEEEEE'
        },
        boldText: {
          bold: true
        }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="job_work_slip_${historyId}.pdf"`);
    pdfDoc.pipe(res);
    pdfDoc.end();

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(req.user.id, req.user.name, 'GENERATE_PDF', `Generated Job Work Slip PDF for history ID ${historyId}`, ip);
  } catch (error) {
    console.error('Generate Job Work Slip PDF error:', error);
    res.status(500).json({ error: 'Server error generating PDF' });
  }
});

// @route   GET /api/pdf/payment-receipt/:paymentId
// @desc    Generate Payment Receipt PDF
router.get('/payment-receipt/:paymentId', async (req, res) => {
  const paymentId = req.params.paymentId;

  try {
    const payment = await db('payments as p')
      .join('vendors as v', 'p.vendor_id', 'v.vendor_id')
      .select('p.*', 'v.vendor_name', 'v.vendor_type', 'v.mobile')
      .where('p.payment_id', paymentId)
      .first();

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    const docDefinition = {
      content: [
        { text: req.user.name.toUpperCase(), style: 'header', alignment: 'center' },
        { text: 'PAYMENT RECEIPT', style: 'title', alignment: 'center', margin: [0, 10, 0, 20] },

        {
          columns: [
            [
              { text: `Paid To: ${payment.vendor_name}`, style: 'boldText' },
              { text: `Vendor Type: ${payment.vendor_type}` },
              { text: `Mobile: ${payment.mobile}` }
            ],
            [
              { text: `Receipt No: PAY-${payment.payment_id}`, style: 'boldText', alignment: 'right' },
              { text: `Payment Date: ${formatDate(payment.payment_date)}`, alignment: 'right' }
            ]
          ]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }], margin: [0, 10, 0, 15] },

        {
          table: {
            widths: ['*', '*'],
            body: [
              [{ text: 'Description', style: 'tableHeader' }, { text: 'Amount', style: 'tableHeader', alignment: 'right' }],
              [
                `Payment received in full via ${payment.payment_method}.\nRemarks: ${payment.remarks || 'None'}`,
                { text: formatCurrency(payment.amount), alignment: 'right', style: 'boldText' }
              ]
            ]
          },
          layout: 'lightHorizontalLines'
        },

        { text: '\n\n\n\n' },
        {
          columns: [
            { text: '___________________\nAuthorized Signatory', alignment: 'left' },
            { text: '___________________\nVendor Signature', alignment: 'right' }
          ]
        },
        getFooterLogo()
      ],
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 11,
        lineHeight: 1.4
      },
      styles: {
        header: {
          fontSize: 18,
          bold: true
        },
        subheader: {
          fontSize: 10,
          color: 'gray'
        },
        title: {
          fontSize: 14,
          bold: true,
          decoration: 'underline'
        },
        tableHeader: {
          bold: true,
          fillColor: '#EEEEEE'
        },
        boldText: {
          bold: true
        }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="payment_receipt_${paymentId}.pdf"`);
    pdfDoc.pipe(res);
    pdfDoc.end();

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(req.user.id, req.user.name, 'GENERATE_PDF', `Generated Payment Receipt PDF for payment ID ${paymentId}`, ip);
  } catch (error) {
    console.error('Generate Payment Receipt PDF error:', error);
    res.status(500).json({ error: 'Server error generating PDF' });
  }
});

// @route   GET /api/pdf/vendor-invoice/:vendorId
// @desc    Generate Vendor Statement/Invoice (Ledger report)
router.get('/vendor-invoice/:vendorId', async (req, res) => {
  const vendorId = req.params.vendorId;
  const { startDate, endDate } = req.query;

  try {
    const vendor = await db('vendors').where({ vendor_id: vendorId }).first();
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Completed Work records
    let workQuery = db('workflow_history as h')
      .join('sarees as s', 'h.saree_id', 's.saree_id')
      .select('h.received_date', 's.lot_number', 's.design_name', 's.quantity', 'h.stage_name', 'h.work_cost')
      .where('h.vendor_id', vendorId)
      .whereNotNull('h.received_date');

    if (startDate) {
      workQuery = workQuery.where('h.received_date', '>=', new Date(startDate));
    }
    if (endDate) {
      workQuery = workQuery.where('h.received_date', '<=', new Date(endDate + 'T23:59:59.999Z'));
    }

    const workRecords = await workQuery.orderBy('h.received_date', 'asc');

    // Payment records
    let paymentQuery = db('payments')
      .select('payment_date', 'amount', 'payment_method')
      .where('vendor_id', vendorId);

    if (startDate) {
      paymentQuery = paymentQuery.where('payment_date', '>=', new Date(startDate));
    }
    if (endDate) {
      paymentQuery = paymentQuery.where('payment_date', '<=', new Date(endDate + 'T23:59:59.999Z'));
    }

    const paymentRecords = await paymentQuery.orderBy('payment_date', 'asc');

    const totalWork = workRecords.reduce((sum, w) => sum + parseFloat(w.work_cost), 0);
    const totalPaid = paymentRecords.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const balance = totalWork - totalPaid;

    // Combine into chronological transactions for the PDF table
    const txs = [];
    workRecords.forEach(w => {
      txs.push({
        date: formatDate(w.received_date),
        desc: `${w.stage_name} work - Lot #${w.lot_number} (${w.design_name}, Qty: ${w.quantity})`,
        credit: parseFloat(w.work_cost),
        debit: 0
      });
    });

    paymentRecords.forEach(p => {
      txs.push({
        date: formatDate(p.payment_date),
        desc: `Payment (${p.payment_method})`,
        credit: 0,
        debit: parseFloat(p.amount)
      });
    });

    // Create table body
    const tableBody = [
      [
        { text: 'Date', style: 'tableHeader' },
        { text: 'Description', style: 'tableHeader' },
        { text: 'Work (Cr)', style: 'tableHeader', alignment: 'right' },
        { text: 'Paid (Dr)', style: 'tableHeader', alignment: 'right' }
      ]
    ];

    txs.forEach(t => {
      tableBody.push([
        t.date,
        t.desc,
        t.credit > 0 ? formatCurrency(t.credit) : '-',
        t.debit > 0 ? formatCurrency(t.debit) : '-'
      ]);
    });

    // Add totals row
    tableBody.push([
      { text: 'TOTALS', style: 'boldText' },
      '',
      { text: formatCurrency(totalWork), style: 'boldText', alignment: 'right' },
      { text: formatCurrency(totalPaid), style: 'boldText', alignment: 'right' }
    ]);

    const docDefinition = {
      content: [
        { text: req.user.name.toUpperCase(), style: 'header', alignment: 'center' },
        { text: 'Saree Manufacturing Ledger Statement', style: 'subheader', alignment: 'center' },
        { text: 'VENDOR STATEMENT', style: 'title', alignment: 'center', margin: [0, 10, 0, 20] },

        {
          columns: [
            [
              { text: `Vendor: ${vendor.vendor_name}`, style: 'boldText' },
              { text: `Type: ${vendor.vendor_type}` },
              { text: `Mobile: ${vendor.mobile}` },
              { text: `Address: ${vendor.address || 'N/A'}` }
            ],
            [
              { text: `Date Generated: ${formatDate(new Date())}`, alignment: 'right' },
              (startDate || endDate) ? { text: `Period: ${startDate || 'Start'} to ${endDate || 'End'}`, alignment: 'right', style: 'subheader' } : { text: 'Period: All Time', alignment: 'right', style: 'subheader' },
              { text: `Total Work Value: ${formatCurrency(totalWork)}`, alignment: 'right' },
              { text: `Total Paid: ${formatCurrency(totalPaid)}`, alignment: 'right' },
              { text: `Net Outstanding: ${formatCurrency(balance)}`, alignment: 'right', style: 'boldText', color: balance > 0 ? 'red' : 'green' }
            ]
          ]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }], margin: [0, 10, 0, 15] },

        { text: 'TRANSACTION HISTORY', style: 'sectionHeader', margin: [0, 5, 0, 10] },
        {
          table: {
            widths: ['20%', '40%', '20%', '20%'],
            body: tableBody
          },
          layout: 'lightHorizontalLines'
        },

        { text: '\n\n\n\n' },
        {
          columns: [
            { text: '___________________\nAuthorized Representative', alignment: 'left' },
            { text: '___________________\nVendor Signature', alignment: 'right' }
          ]
        },
        getFooterLogo()
      ],
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 10,
        lineHeight: 1.4
      },
      styles: {
        header: {
          fontSize: 18,
          bold: true
        },
        subheader: {
          fontSize: 9,
          color: 'gray'
        },
        title: {
          fontSize: 13,
          bold: true,
          decoration: 'underline'
        },
        sectionHeader: {
          fontSize: 11,
          bold: true
        },
        tableHeader: {
          bold: true,
          fillColor: '#EEEEEE'
        },
        boldText: {
          bold: true
        }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="vendor_invoice_${vendorId}.pdf"`);
    pdfDoc.pipe(res);
    pdfDoc.end();

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(req.user.id, req.user.name, 'GENERATE_PDF', `Generated Vendor Ledger Statement PDF for vendor ID ${vendorId}`, ip);
  } catch (error) {
    console.error('Generate Vendor Statement PDF error:', error);
    res.status(500).json({ error: 'Server error generating PDF' });
  }
});// @route   GET /api/pdf/production-report
// @desc    Generate Complete Production Status Report PDF with filters
router.get('/production-report', async (req, res) => {
  const { vendorId, stage, startDate, endDate } = req.query;

  try {
    let query = db('sarees as s')
      .leftJoin('vendors as v', 's.current_vendor_id', 'v.vendor_id')
      .select('s.*', 'v.vendor_name')
      .orderBy('s.lot_number', 'asc');

    if (vendorId) query = query.where('s.current_vendor_id', vendorId);
    if (stage) query = query.where('s.current_stage', stage);
    if (startDate) query = query.where('s.created_at', '>=', new Date(startDate));
    if (endDate) query = query.where('s.created_at', '<=', new Date(endDate + 'T23:59:59.999Z'));

    const sarees = await query;

    const tableBody = [
      [
        { text: 'Lot No', style: 'tableHeader' },
        { text: 'Design Name', style: 'tableHeader' },
        { text: 'Qty', style: 'tableHeader' },
        { text: 'Stage', style: 'tableHeader' },
        { text: 'Current Vendor', style: 'tableHeader' },
        { text: 'Status', style: 'tableHeader' }
      ]
    ];

    sarees.forEach(s => {
      tableBody.push([
        s.lot_number.toString(),
        s.design_name,
        s.quantity.toString(),
        s.current_stage,
        s.vendor_name || 'In Workshop',
        s.status
      ]);
    });

    const docDefinition = {
      content: [
        { text: req.user.name.toUpperCase(), style: 'header', alignment: 'center' },
        { text: 'Saree Manufacturing Status Report', style: 'subheader', alignment: 'center' },
        { text: 'PRODUCTION HISTORY REPORT', style: 'title', alignment: 'center', margin: [0, 10, 0, 20] },

        { 
          columns: [
            { text: `Report Generated: ${formatDate(new Date())}`, style: 'boldText' },
            { 
              text: `Filters Applied: ${[
                stage ? `Stage: ${stage}` : '',
                startDate ? `From: ${startDate}` : '',
                endDate ? `To: ${endDate}` : ''
              ].filter(Boolean).join(', ') || 'None'}`, 
              alignment: 'right', 
              style: 'subheader' 
            }
          ]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }], margin: [0, 5, 0, 15] },

        {
          table: {
            widths: ['10%', '30%', '10%', '15%', '20%', '15%'],
            body: tableBody
          },
          layout: 'lightHorizontalLines'
        },
        getFooterLogo()
      ],
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 10,
        lineHeight: 1.4
      },
      styles: {
        header: { fontSize: 18, bold: true },
        subheader: { fontSize: 9, color: 'gray' },
        title: { fontSize: 13, bold: true, decoration: 'underline' },
        tableHeader: { bold: true, fillColor: '#EEEEEE' },
        boldText: { bold: true }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="production_report.pdf"');
    pdfDoc.pipe(res);
    pdfDoc.end();

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(req.user.id, req.user.name, 'GENERATE_PDF', `Generated Production History Report PDF`, ip);
  } catch (error) {
    console.error('Generate Production Report PDF error:', error);
    res.status(500).json({ error: 'Server error generating PDF' });
  }
});

// @route   GET /api/pdf/payments-report
// @desc    Generate Complete Payments Report PDF with filters
router.get('/payments-report', async (req, res) => {
  const { vendorId, vendorType, startDate, endDate } = req.query;

  try {
    let query = db('payments as p')
      .join('vendors as v', 'p.vendor_id', 'v.vendor_id')
      .select('p.*', 'v.vendor_name', 'v.vendor_type')
      .orderBy('p.payment_date', 'desc');

    if (vendorId) query = query.where('p.vendor_id', vendorId);
    if (vendorType) query = query.where('v.vendor_type', vendorType);
    if (startDate) query = query.where('p.payment_date', '>=', new Date(startDate));
    if (endDate) query = query.where('p.payment_date', '<=', new Date(endDate + 'T23:59:59.999Z'));

    const payments = await query;
    const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const tableBody = [
      [
        { text: 'Date', style: 'tableHeader' },
        { text: 'Vendor Name', style: 'tableHeader' },
        { text: 'Vendor Type', style: 'tableHeader' },
        { text: 'Method', style: 'tableHeader' },
        { text: 'Remarks', style: 'tableHeader' },
        { text: 'Amount', style: 'tableHeader', alignment: 'right' }
      ]
    ];

    payments.forEach(p => {
      tableBody.push([
        formatDate(p.payment_date).split(' ')[0], // Date only
        p.vendor_name,
        p.vendor_type,
        p.payment_method,
        p.remarks || '-',
        { text: formatCurrency(p.amount), alignment: 'right' }
      ]);
    });

    tableBody.push([
      { text: 'TOTAL PAID', style: 'boldText' },
      '',
      '',
      '',
      '',
      { text: formatCurrency(totalAmount), style: 'boldText', alignment: 'right' }
    ]);

    const docDefinition = {
      content: [
        { text: req.user.name.toUpperCase(), style: 'header', alignment: 'center' },
        { text: 'Saree Manufacturing Vendor Payments Log', style: 'subheader', alignment: 'center' },
        { text: 'VENDOR PAYMENTS REPORT', style: 'title', alignment: 'center', margin: [0, 10, 0, 20] },

        {
          columns: [
            { text: `Report Generated: ${formatDate(new Date())}`, style: 'boldText' },
            {
              text: `Filters Applied: ${[
                vendorType ? `Type: ${vendorType}` : '',
                startDate ? `From: ${startDate}` : '',
                endDate ? `To: ${endDate}` : ''
              ].filter(Boolean).join(', ') || 'None'}`,
              alignment: 'right',
              style: 'subheader'
            }
          ]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }], margin: [0, 5, 0, 15] },

        {
          table: {
            widths: ['15%', '25%', '15%', '15%', '15%', '15%'],
            body: tableBody
          },
          layout: 'lightHorizontalLines'
        },
        getFooterLogo()
      ],
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 10,
        lineHeight: 1.4
      },
      styles: {
        header: { fontSize: 18, bold: true },
        subheader: { fontSize: 9, color: 'gray' },
        title: { fontSize: 13, bold: true, decoration: 'underline' },
        tableHeader: { bold: true, fillColor: '#EEEEEE' },
        boldText: { bold: true }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="payments_report.pdf"');
    pdfDoc.pipe(res);
    pdfDoc.end();

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(req.user.id, req.user.name, 'GENERATE_PDF', `Generated Payments Report PDF`, ip);
  } catch (error) {
    console.error('Generate Payments Report PDF error:', error);
    res.status(500).json({ error: 'Server error generating PDF' });
  }
});

// @route   GET /api/pdf/outstanding-report
// @desc    Generate Complete Outstanding Liabilities Report PDF with filters (Replaces window.print)
router.get('/outstanding-report', async (req, res) => {
  const { vendorId, vendorType, startDate, endDate } = req.query;

  try {
    let vendorsQuery = db('vendors');
    if (vendorId) vendorsQuery = vendorsQuery.where('vendor_id', vendorId);
    if (vendorType) vendorsQuery = vendorsQuery.where('vendor_type', vendorType);
    const vendors = await vendorsQuery.orderBy('vendor_name', 'asc');

    let workQuery = db('workflow_history').select('vendor_id').sum('work_cost as total_work').whereNotNull('received_date').groupBy('vendor_id');
    if (startDate) workQuery = workQuery.where('received_date', '>=', new Date(startDate));
    if (endDate) workQuery = workQuery.where('received_date', '<=', new Date(endDate + 'T23:59:59.999Z'));
    const workSummary = await workQuery;

    let paymentQuery = db('payments').select('vendor_id').sum('amount as total_paid').groupBy('vendor_id');
    if (startDate) paymentQuery = paymentQuery.where('payment_date', '>=', new Date(startDate));
    if (endDate) paymentQuery = paymentQuery.where('payment_date', '<=', new Date(endDate + 'T23:59:59.999Z'));
    const paymentSummary = await paymentQuery;

    const workMap = new Map(workSummary.map(w => [w.vendor_id, w]));
    const paymentMap = new Map(paymentSummary.map(p => [p.vendor_id, p]));

    const outstandingVendors = vendors
      .map(vendor => {
        const vId = vendor.vendor_id;
        const workTotal = parseFloat(workMap.get(vId)?.total_work || 0);
        const paymentTotal = parseFloat(paymentMap.get(vId)?.total_paid || 0);
        const balance = workTotal - paymentTotal;

        return {
          vendor_name: vendor.vendor_name,
          vendor_type: vendor.vendor_type,
          mobile: vendor.mobile,
          total_work: workTotal,
          total_paid: paymentTotal,
          pending_balance: balance
        };
      })
      .filter(v => v.pending_balance > 0);

    const totalOutstanding = outstandingVendors.reduce((sum, v) => sum + v.pending_balance, 0);

    const tableBody = [
      [
        { text: 'Vendor Name', style: 'tableHeader' },
        { text: 'Vendor Type', style: 'tableHeader' },
        { text: 'Work Completed (Cr)', style: 'tableHeader', alignment: 'right' },
        { text: 'Total Paid (Dr)', style: 'tableHeader', alignment: 'right' },
        { text: 'Outstanding Balance', style: 'tableHeader', alignment: 'right' }
      ]
    ];

    outstandingVendors.forEach(v => {
      tableBody.push([
        v.vendor_name,
        v.vendor_type,
        { text: formatCurrency(v.total_work), alignment: 'right' },
        { text: formatCurrency(v.total_paid), alignment: 'right' },
        { text: formatCurrency(v.pending_balance), alignment: 'right', style: 'boldText', color: 'red' }
      ]);
    });

    tableBody.push([
      { text: 'TOTAL OUTSTANDING', style: 'boldText' },
      '',
      '',
      '',
      { text: formatCurrency(totalOutstanding), style: 'boldText', alignment: 'right', color: 'red' }
    ]);

    const docDefinition = {
      content: [
        { text: req.user.name.toUpperCase(), style: 'header', alignment: 'center' },
        { text: 'Saree Manufacturing Unpaid Vendor Liabilities Ledger', style: 'subheader', alignment: 'center' },
        { text: 'OUTSTANDING LIABILITIES REPORT', style: 'title', alignment: 'center', margin: [0, 10, 0, 20] },

        {
          columns: [
            { text: `Report Generated: ${formatDate(new Date())}`, style: 'boldText' },
            {
              text: `Filters Applied: ${[
                vendorType ? `Type: ${vendorType}` : '',
                startDate ? `From: ${startDate}` : '',
                endDate ? `To: ${endDate}` : ''
              ].filter(Boolean).join(', ') || 'None'}`,
              alignment: 'right',
              style: 'subheader'
            }
          ]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }], margin: [0, 5, 0, 15] },

        {
          table: {
            widths: ['30%', '15%', '18%', '17%', '20%'],
            body: tableBody
          },
          layout: 'lightHorizontalLines'
        },
        getFooterLogo()
      ],
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 10,
        lineHeight: 1.4
      },
      styles: {
        header: { fontSize: 18, bold: true },
        subheader: { fontSize: 9, color: 'gray' },
        title: { fontSize: 13, bold: true, decoration: 'underline' },
        tableHeader: { bold: true, fillColor: '#EEEEEE' },
        boldText: { bold: true }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="outstanding_report.pdf"');
    pdfDoc.pipe(res);
    pdfDoc.end();

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(req.user.id, req.user.name, 'GENERATE_PDF', `Generated Outstanding Dues Report PDF`, ip);
  } catch (error) {
    console.error('Generate Outstanding Dues Report PDF error:', error);
    res.status(500).json({ error: 'Server error generating PDF' });
  }
});

module.exports = router;
