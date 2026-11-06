const { readFileSync } = require('node:fs');
const path = require('node:path');
const seed = path.resolve(__dirname, '../../database/seed');
const read = file => JSON.parse(readFileSync(path.join(seed, `${file}.json`), 'utf8'));

// Only migration scripts and tests may import fixtures. The app never imports JSON.
function readFixtures() {
  return {
    metadata: read('metadata'), overview: read('analytics/overview'),
    users: read('entities/users'), businesses: read('entities/businesses'),
    memberships: read('entities/memberships'), branches: read('entities/branches'),
    systems: read('entities/systems'), sales: read('entities/sales'),
    products: read('entities/products'), stock: read('entities/stock-balances'),
    suppliers: read('entities/suppliers'), cashTransactions: read('entities/cash-transactions'),
    events: read('entities/events'), notifications: read('entities/notifications'),
    periods: read('analytics/periods'), salesHistory: read('analytics/sales'),
    inventoryHistory: read('analytics/inventory'), cashHistory: read('analytics/cash'),
    companyHistory: read('analytics/company'),
  };
}
module.exports = { readFixtures };
