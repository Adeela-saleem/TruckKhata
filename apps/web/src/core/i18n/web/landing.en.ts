/** Text for the public landing page. Every key needs its Urdu line in landing.ur.ts. */
export const landingEn = {
  nav: { features: 'Features', how: 'How it works', languages: 'Languages', data: 'Security', faq: 'FAQ' },
  signIn: 'Sign in',
  start: 'Get started',
  demo: 'Book a demo',
  demoSubject: 'Truck Khata demo',
  openKhata: 'Open your khata',
  skip: 'Skip to content',
  shotAlt: 'Truck Khata screen',
  hero: {
    title: 'See what every trip earned, and who still owes you',
    sub: 'Truck Khata is accounting software for transport companies. Ada Register, trip sheets, Bill Book and broker accounts in one place, linked by a single Case #.',
    note: 'Urdu and English. Runs in your browser. Your records stay on your computer.',
    cards: {
      profit: { label: 'Net profit', sub: 'TK-1151, Karachi to Lahore', value: 'Rs 75,004', badge: 'Confirmed' },
      owed: { label: 'Haji Rafiq Goods', sub: 'Outstanding balance', value: 'Rs 1,510,500' },
      alerts: { label: 'Insurance alerts', sub: 'Expired or expiring soon', value: '3 trucks' },
    },
  },
  stats: {
    modules: { value: '6', label: 'Modules linked by one Case #' },
    reports: { value: '8', label: 'Reports, each with PDF and Excel' },
    languages: { value: '2', label: 'Languages, Urdu and English' },
    servers: { value: '0', label: 'Servers holding your accounts' },
  },
  features: {
    title: 'Everything the register does, and the sums it never did',
    sub: 'Six modules that share one Case #. Enter a load once and it flows through the trip sheet, the broker’s account and the month’s report.',
    items: {
      ada: { name: 'Ada Register', line: 'Record every load like a bilty, with the amount due worked out for you.' },
      sheet: { name: 'Trip sheet', line: 'Outward and return on one sheet, with every expense and the net profit.' },
      broker: { name: 'Brokers and parties', line: 'Each broker’s freight, receipts and balance, to the rupee.' },
      bills: { name: 'Bill Book', line: 'Shop bills by truck, paid and unpaid, counted in a trip or the month.' },
      insurance: { name: 'Truck insurance', line: 'Every truck’s policy dates, with a warning before one expires.' },
      report: { name: 'Reports', line: 'The monthly sheet for each truck, ending in the bachat.' },
    },
  },
  more: {
    title: 'Built for daily use at the adda',
    items: {
      search: { title: 'Search by Case #', text: 'Type a Case # on any screen and see its entries, trip, bills and receipts together.' },
      print: { title: 'Print and PDF', text: 'Every record and list prints with your company name, phone and logo watermark.' },
      excel: { title: 'Excel export', text: 'Any list or report opens in Excel exactly as it appears on screen.' },
      history: { title: 'History on every record', text: 'Each entry keeps what was changed and when, and the history prints as a PDF.' },
      bin: { title: 'Recycle Bin', text: 'Deleted something by mistake? Restore it, or remove it for good.' },
      backup: { title: 'Backup and restore', text: 'Download one file with the whole khata and restore it on any computer.' },
    },
  },
  how: {
    title: 'Running in three steps',
    steps: {
      account: { title: 'Create your account', text: 'Set up Truck Khata on your computer in about a minute. Add your company name and logo for prints.' },
      entry: { title: 'Enter your first load', text: 'Write an Ada entry with its Case #, or load the sample khata to explore six months of example trips.' },
      month: { title: 'Read the month', text: 'Open the trip sheet, the broker’s statement or the monthly report. Print it or send the PDF.' },
    },
  },
  languages: {
    title: 'اردو or English, the same khata',
    sub: 'Switch language from any screen. The whole app and its prints change, the layout turns right to left, and your figures, Case # and V# stay exactly as they were.',
    button: 'View this page in اردو',
  },
  data: {
    title: 'Your accounts never leave your computer',
    sub: 'Truck Khata has no server holding your records. That keeps them private, and it comes with one habit worth keeping.',
    points: {
      where: { title: 'Stored on your computer', text: 'Records live in this browser on this computer. Nothing is uploaded, and several tabs can be open at once.' },
      accounts: { title: 'Password-protected accounts', text: 'Each person signs in with an email and password. Passwords are stored only as a salted hash.' },
      backup: { title: 'Backups you control', text: 'Clearing the browser’s site data removes the khata, so download a backup regularly. The dashboard reminds you after a week.' },
    },
  },
  testimonials: {
    title: 'What transport owners say',
    placeholder: 'Sample, replace before launch',
    items: {
      a: { quote: 'Add a real customer quote here about seeing the profit of each trip.', name: 'Customer name', role: 'Owner, company and city' },
      b: { quote: 'Add a real customer quote here about broker balances and statements.', name: 'Customer name', role: 'Owner, company and city' },
      c: { quote: 'Add a real customer quote here about the monthly report and bachat.', name: 'Customer name', role: 'Munshi, company and city' },
    },
  },
  faq: {
    title: 'Frequently asked questions',
    items: {
      internet: { q: 'Does my data go to the internet?', a: 'No. Records and accounts are saved in the browser on your computer. The website only delivers the app itself.' },
      computers: { q: 'Can two computers share one khata?', a: 'Each computer keeps its own khata. To move or copy it, download a backup on one computer and restore it on the other.' },
      urdu: { q: 'Can my munshi use it in Urdu?', a: 'Yes. One button switches the whole app and its prints between Urdu and English, and entries can be typed in either.' },
      mistake: { q: 'What if an entry is deleted by mistake?', a: 'It goes to the Recycle Bin and can be restored. Every record also keeps a history of its changes.' },
      print: { q: 'Can I give a broker a printed statement?', a: 'Yes. A broker’s statement, any trip sheet and every list print or save as PDF with your company header and watermark.' },
      profit: { q: 'How is a trip’s profit worked out?', a: 'Freight for outward and return together, minus the trip’s expenses and any bills counted in it. It stays provisional until you mark the trip complete.' },
    },
  },
  final: {
    title: 'Put your khata on your computer today',
    sub: 'Create an account and enter your first load, or book a demo and we will walk you through it.',
  },
  footer: {
    product: 'Product',
    account: 'Account',
    line: 'Accounting software for transport companies, in Urdu and English.',
    note: 'Records and accounts stay in this browser on this computer.',
  },
};
