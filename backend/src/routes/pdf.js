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

    // Find all history records for this saree to calculate sequential C.H NO suffix
    const allHistory = await db('workflow_history')
      .where({ saree_id: history.saree_id })
      .orderBy('history_id', 'asc')
      .select('history_id');

    const recordIndex = allHistory.findIndex(h => h.history_id === parseInt(historyId));
    const chSuffix = recordIndex !== -1 ? (recordIndex + 1) : 1;

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
              { text: `Challan No: ${history.lot_number}.${chSuffix}`, style: 'boldText', alignment: 'right' },
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

// @route   GET /api/pdf/vendor-statement/:vendorId
// @desc    Generate printable ledger statement for a single vendor including running balance
router.get('/vendor-statement/:vendorId', async (req, res) => {
  const vendorId = req.params.vendorId;
  const { startDate, endDate } = req.query;

  try {
    const vendor = await db('vendors').where({ vendor_id: vendorId }).first();
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // 1. Fetch completed work records
    let workQuery = db('workflow_history as h')
      .join('sarees as s', 'h.saree_id', 's.saree_id')
      .select('h.history_id', 'h.received_date as date', 's.lot_number', 's.design_name', 's.quantity', 'h.stage_name', 'h.work_cost as amount', 'h.saree_id')
      .where('h.vendor_id', vendorId)
      .whereNotNull('h.received_date');

    if (startDate) workQuery = workQuery.where('h.received_date', '>=', new Date(startDate));
    if (endDate) workQuery = workQuery.where('h.received_date', '<=', new Date(endDate + 'T23:59:59.999Z'));

    const workRecords = await workQuery.orderBy('h.received_date', 'asc').orderBy('h.history_id', 'asc');

    // Dynamically calculate ch_suffix for each work record
    const sareeHistoryIds = {};
    const allWorkForVendor = await db('workflow_history')
      .where({ vendor_id: vendorId })
      .whereNotNull('received_date')
      .orderBy('history_id', 'asc')
      .select('history_id', 'saree_id');

    allWorkForVendor.forEach(wh => {
      if (!sareeHistoryIds[wh.saree_id]) {
        sareeHistoryIds[wh.saree_id] = [];
      }
      sareeHistoryIds[wh.saree_id].push(wh.history_id);
    });

    // 2. Fetch payments & discounts
    let paymentQuery = db('payments')
      .select('payment_id', 'payment_date as date', 'amount', 'discount', 'discount_reason', 'payment_method', 'remarks')
      .where('vendor_id', vendorId);

    if (startDate) paymentQuery = paymentQuery.where('payment_date', '>=', new Date(startDate));
    if (endDate) paymentQuery = paymentQuery.where('payment_date', '<=', new Date(endDate + 'T23:59:59.999Z'));

    const paymentRecords = await paymentQuery.orderBy('payment_date', 'asc').orderBy('payment_id', 'asc');

    // 3. Create combined chronological ledger
    const ledger = [];

    workRecords.forEach(w => {
      const chIdx = sareeHistoryIds[w.saree_id]?.indexOf(w.history_id) ?? -1;
      const chSuffix = chIdx !== -1 ? (chIdx + 1) : 1;
      ledger.push({
        date: new Date(w.date),
        lot_number: w.lot_number,
        challan_number: `${w.lot_number}.${chSuffix}`,
        desc: `${w.stage_name} work completed (Qty: ${w.quantity})`,
        debit: 0,
        credit: parseFloat(w.amount),
        type: 'work'
      });
    });

    paymentRecords.forEach(p => {
      if (parseFloat(p.amount) > 0) {
        ledger.push({
          date: new Date(p.date),
          lot_number: null,
          challan_number: null,
          desc: `Paid via ${p.payment_method} ${p.remarks ? `(${p.remarks})` : ''}`,
          debit: parseFloat(p.amount),
          credit: 0,
          type: 'payment'
        });
      }
      if (parseFloat(p.discount) > 0) {
        ledger.push({
          date: new Date(p.date),
          lot_number: null,
          challan_number: null,
          desc: `Discount applied: ${p.discount_reason || 'General Discount'}`,
          debit: parseFloat(p.discount),
          credit: 0,
          type: 'discount'
        });
      }
    });

    // Sort ledger chronologically
    ledger.sort((a, b) => a.date - b.date);

    // Calculate running balance
    let runningBalance = 0;
    const tableBody = [
      [
        { text: 'Date', style: 'tableHeader' },
        { text: 'Lot No', style: 'tableHeader' },
        { text: 'Challan No', style: 'tableHeader' },
        { text: 'Description', style: 'tableHeader' },
        { text: 'Debit (Dr)', style: 'tableHeader', alignment: 'right' },
        { text: 'Credit (Cr)', style: 'tableHeader', alignment: 'right' },
        { text: 'Running Balance', style: 'tableHeader', alignment: 'right' }
      ]
    ];

    let totalDebit = 0;
    let totalCredit = 0;

    ledger.forEach(entry => {
      if (entry.type === 'work') {
        runningBalance += entry.credit;
        totalCredit += entry.credit;
      } else {
        runningBalance -= entry.debit;
        totalDebit += entry.debit;
      }

      tableBody.push([
        entry.date.toLocaleDateString('en-IN'),
        entry.lot_number ? entry.lot_number.toString() : '-',
        entry.challan_number ? entry.challan_number : '-',
        entry.desc,
        entry.debit > 0 ? formatCurrency(entry.debit) : '-',
        entry.credit > 0 ? formatCurrency(entry.credit) : '-',
        { text: formatCurrency(runningBalance), alignment: 'right', style: 'boldText', color: runningBalance > 0 ? 'red' : 'green' }
      ]);
    });

    // Total summary row
    tableBody.push([
      { text: 'TOTAL SUMMARY', style: 'boldText' },
      '',
      '',
      '',
      { text: formatCurrency(totalDebit), style: 'boldText', alignment: 'right' },
      { text: formatCurrency(totalCredit), style: 'boldText', alignment: 'right' },
      { text: formatCurrency(runningBalance), style: 'boldText', alignment: 'right', color: runningBalance > 0 ? 'red' : 'green' }
    ]);

    const docDefinition = {
      content: [
        { text: req.user.name.toUpperCase(), style: 'header', alignment: 'center' },
        { text: 'Saree Manufacturing Ledger Statement', style: 'subheader', alignment: 'center' },
        { text: 'VENDOR PAYMENT LEDGER STATEMENT', style: 'title', alignment: 'center', margin: [0, 10, 0, 20] },

        {
          columns: [
            [
              { text: `Vendor Name: ${vendor.vendor_name}`, style: 'boldText' },
              { text: `Vendor Type: ${vendor.vendor_type}` },
              { text: `Mobile: ${vendor.mobile}` },
              { text: `Address: ${vendor.address || 'N/A'}` }
            ],
            [
              { text: `Date Generated: ${formatDate(new Date())}`, alignment: 'right' },
              (startDate || endDate) ? { text: `Period: ${startDate || 'Start'} to ${endDate || 'End'}`, alignment: 'right', style: 'subheader' } : { text: 'Period: All Time', alignment: 'right', style: 'subheader' },
              { text: `Total Work Cost (Cr): ${formatCurrency(totalCredit)}`, alignment: 'right' },
              { text: `Total Paid (Dr): ${formatCurrency(totalDebit)}`, alignment: 'right' },
              { text: `Outstanding Balance: ${formatCurrency(runningBalance)}`, alignment: 'right', style: 'boldText', color: runningBalance > 0 ? 'red' : 'green' }
            ]
          ]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }], margin: [0, 10, 0, 15] },

        { text: 'TRANSACTION STATEMENT', style: 'sectionHeader', margin: [0, 5, 0, 10] },
        {
          table: {
            widths: ['12%', '10%', '13%', '29%', '12%', '12%', '12%'],
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
        fontSize: 9,
        lineHeight: 1.4
      },
      styles: {
        header: { fontSize: 18, bold: true },
        subheader: { fontSize: 9, color: 'gray' },
        title: { fontSize: 13, bold: true, decoration: 'underline' },
        sectionHeader: { fontSize: 11, bold: true },
        tableHeader: { bold: true, fillColor: '#EEEEEE' },
        boldText: { bold: true }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="vendor_statement_${vendorId}.pdf"`);
    pdfDoc.pipe(res);
    pdfDoc.end();

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(req.user.id, req.user.name, 'GENERATE_PDF', `Generated Vendor Ledger Statement PDF for vendor ID ${vendorId}`, ip);
  } catch (error) {
    console.error('Generate Vendor Statement PDF error:', error);
    res.status(500).json({ error: 'Server error generating PDF' });
  }
});

// @route   GET /api/pdf/payments-ledger-statement
// @desc    Generate complete payments ledger statement matching active filters
router.get('/payments-ledger-statement', async (req, res) => {
  const { vendorId, startDate, endDate } = req.query;

  try {
    // 1. Get completed workflow history records
    let workQuery = db('workflow_history as h')
      .join('sarees as s', 'h.saree_id', 's.saree_id')
      .join('vendors as v', 'h.vendor_id', 'v.vendor_id')
      .select(
        'h.history_id',
        'h.received_date as date',
        's.lot_number',
        's.design_name',
        's.quantity',
        'v.vendor_id',
        'v.vendor_name',
        'v.vendor_type',
        'h.stage_name as work_stage',
        'h.work_cost as work_amount',
        'h.saree_id'
      )
      .whereNotNull('h.received_date');

    if (vendorId) {
      workQuery = workQuery.where('h.vendor_id', vendorId);
    }
    if (startDate) {
      workQuery = workQuery.where('h.received_date', '>=', new Date(startDate));
    }
    if (endDate) {
      workQuery = workQuery.where('h.received_date', '<=', new Date(endDate + 'T23:59:59.999Z'));
    }

    const workRecords = await workQuery.orderBy('h.received_date', 'asc').orderBy('h.history_id', 'asc');

    // 2. Fetch sum of payments and discounts grouped by history_id
    const paymentsSummary = await db('payments')
      .select('history_id')
      .sum('amount as total_paid')
      .sum('discount as total_discount')
      .groupBy('history_id');

    const paymentMap = new Map(
      paymentsSummary.map(p => [
        p.history_id,
        {
          total_paid: parseFloat(p.total_paid || 0),
          total_discount: parseFloat(p.total_discount || 0)
        }
      ])
    );

    // Dynamic sorting/order map for challan suffix calculation per saree_id
    const sareeHistoryIds = {};
    const allWork = await db('workflow_history')
      .whereNotNull('received_date')
      .orderBy('history_id', 'asc')
      .select('history_id', 'saree_id');

    allWork.forEach(wh => {
      if (!sareeHistoryIds[wh.saree_id]) {
        sareeHistoryIds[wh.saree_id] = [];
      }
      sareeHistoryIds[wh.saree_id].push(wh.history_id);
    });

    let totalWorkVal = 0;
    let totalDiscountVal = 0;
    let totalPaidVal = 0;
    let totalOutstandingVal = 0;

    const tableBody = [
      [
        { text: 'Challan No', style: 'tableHeader' },
        { text: 'Vendor Name', style: 'tableHeader' },
        { text: 'Stage', style: 'tableHeader' },
        { text: 'Work Cost', style: 'tableHeader', alignment: 'right' },
        { text: 'Discount', style: 'tableHeader', alignment: 'right' },
        { text: 'Paid', style: 'tableHeader', alignment: 'right' },
        { text: 'Outstanding', style: 'tableHeader', alignment: 'right' },
        { text: 'Status', style: 'tableHeader' }
      ]
    ];

    workRecords.forEach(wr => {
      const pSum = paymentMap.get(wr.history_id) || { total_paid: 0, total_discount: 0 };
      
      const workAmount = parseFloat(wr.work_amount || 0);
      const discount = pSum.total_discount;
      const netAmount = Math.max(0, workAmount - discount);
      const paidAmount = pSum.total_paid;
      const outstandingAmount = Math.max(0, netAmount - paidAmount);
      
      let paymentStatusVal = 'Unpaid';
      if (paidAmount >= netAmount && (netAmount > 0 || paidAmount > 0)) {
        paymentStatusVal = 'Paid';
      } else if (paidAmount > 0) {
        paymentStatusVal = 'Partially Paid';
      }

      const chIdx = sareeHistoryIds[wr.saree_id]?.indexOf(wr.history_id) ?? -1;
      const chSuffix = chIdx !== -1 ? (chIdx + 1) : 1;
      const challanNumber = `${wr.lot_number}.${chSuffix}`;

      totalWorkVal += workAmount;
      totalDiscountVal += discount;
      totalPaidVal += paidAmount;
      totalOutstandingVal += outstandingAmount;

      tableBody.push([
        challanNumber,
        wr.vendor_name,
        wr.work_stage,
        { text: formatCurrency(workAmount), alignment: 'right' },
        { text: discount > 0 ? formatCurrency(discount) : '-', alignment: 'right' },
        { text: paidAmount > 0 ? formatCurrency(paidAmount) : '-', alignment: 'right' },
        { text: outstandingAmount > 0 ? formatCurrency(outstandingAmount) : '-', alignment: 'right', style: outstandingAmount > 0 ? 'boldText' : null, color: outstandingAmount > 0 ? 'red' : null },
        { text: paymentStatusVal, color: paymentStatusVal === 'Paid' ? 'green' : (paymentStatusVal === 'Partially Paid' ? 'orange' : 'red'), style: 'boldText' }
      ]);
    });

    // Totals Row
    tableBody.push([
      { text: 'TOTALS', style: 'boldText' },
      '',
      '',
      { text: formatCurrency(totalWorkVal), style: 'boldText', alignment: 'right' },
      { text: formatCurrency(totalDiscountVal), style: 'boldText', alignment: 'right' },
      { text: formatCurrency(totalPaidVal), style: 'boldText', alignment: 'right' },
      { text: formatCurrency(totalOutstandingVal), style: 'boldText', alignment: 'right', color: totalOutstandingVal > 0 ? 'red' : 'green' },
      ''
    ]);

    let vendorHeader = 'All Vendors';
    if (vendorId && workRecords.length > 0) {
      vendorHeader = `${workRecords[0].vendor_name} (${workRecords[0].vendor_type})`;
    }

    const docDefinition = {
      content: [
        { text: req.user.name.toUpperCase(), style: 'header', alignment: 'center' },
        { text: 'Saree Manufacturing Vendor Payments Statement', style: 'subheader', alignment: 'center' },
        { text: 'VENDOR PAYMENT STATEMENT PDF', style: 'title', alignment: 'center', margin: [0, 10, 0, 20] },

        {
          columns: [
            [
              { text: `Vendor Partner: ${vendorHeader}`, style: 'boldText' },
              { text: `Date Range: ${startDate || 'Start'} to ${endDate || 'End'}` }
            ],
            [
              { text: `Report Generated: ${formatDate(new Date())}`, alignment: 'right' },
              { text: `Total Outstanding Payable: ${formatCurrency(totalOutstandingVal)}`, alignment: 'right', style: 'boldText', color: totalOutstandingVal > 0 ? 'red' : 'green' }
            ]
          ]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }], margin: [0, 10, 0, 15] },

        {
          table: {
            widths: ['12%', '20%', '10%', '14%', '11%', '11%', '12%', '10%'],
            body: tableBody
          },
          layout: 'lightHorizontalLines'
        },
        getFooterLogo()
      ],
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 9,
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
    res.setHeader('Content-Disposition', 'inline; filename="vendor_payment_statement.pdf"');
    pdfDoc.pipe(res);
    pdfDoc.end();

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(req.user.id, req.user.name, 'GENERATE_PDF', `Exported Vendor Payment Statement PDF`, ip);
  } catch (error) {
    console.error('Generate Vendor Payment Statement PDF error:', error);
    res.status(500).json({ error: 'Server error generating PDF' });
  }
});

module.exports = router;

