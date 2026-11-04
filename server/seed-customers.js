require('dotenv').config({ path: 'E:/PMR-Traders/server/.env' });
const pool = require('./src/db');

// Customer lists from PM Reddy Poultry Traders group summaries (1-Jul-2024)
const sureshCustomers = [
  { name: 'AJJU', opBal: 106.40, type: 'DR' },
  { name: 'AKHIL', opBal: 26466.25, type: 'DR' },
  { name: 'Aleru', opBal: 4248.65, type: 'DR' },
  { name: 'Amanagal', opBal: 46667.24, type: 'DR' },
  { name: 'Beruwada', opBal: 17512.49, type: 'DR' },
  { name: 'Chand Png', opBal: 29242.60, type: 'DR' },
  { name: 'Devi', opBal: 56219.41, type: 'DR' },
  { name: 'Imam (Boddugonda)', opBal: 606965.72, type: 'DR' },
  { name: 'K S M 2', opBal: 202.90, type: 'CR' },
  { name: 'Ksm New', opBal: 24.10, type: 'DR' },
  { name: 'Kumar Pusapally', opBal: 608973.45, type: 'DR' },
  { name: 'K.Venkanna', opBal: 886110.60, type: 'DR' },
  { name: 'L Thanda', opBal: 15.40, type: 'DR' },
  { name: 'M Afsar', opBal: 129765.00, type: 'DR' },
  { name: 'Mahankali', opBal: 5234.80, type: 'DR' },
  { name: 'M Akbar', opBal: 1.20, type: 'DR' },
  { name: 'Malyala', opBal: 40.40, type: 'CR' },
  { name: 'M Ameen', opBal: 191585.25, type: 'DR' },
  { name: 'M Ameer', opBal: 309170.76, type: 'DR' },
  { name: 'M AMMA', opBal: 79004.90, type: 'DR' },
  { name: 'Mateen', opBal: 136931.90, type: 'DR' },
  { name: 'M Babu', opBal: 8085.90, type: 'DR' },
  { name: 'M Bindhu', opBal: 275962.89, type: 'DR' },
  { name: 'M Ganesh', opBal: 71148.48, type: 'DR' },
  { name: 'M Harish', opBal: 56677.30, type: 'DR' },
  { name: 'M Meenar', opBal: 683492.96, type: 'DR' },
  { name: 'M Mokshith', opBal: 187.70, type: 'CR' },
  { name: 'M Munesh', opBal: 15361.70, type: 'DR' },
  { name: 'Mogili', opBal: 76232.88, type: 'DR' },
  { name: 'M Saibaba', opBal: 3015767.04, type: 'DR' },
  { name: 'M Taj', opBal: 503722.64, type: 'DR' },
  { name: 'Mubeen', opBal: 120997.34, type: 'DR' },
  { name: 'M Varshith', opBal: 58297.40, type: 'DR' },
  { name: 'M. Vijaya', opBal: 114696.00, type: 'DR' },
  { name: 'M Vinod', opBal: 9225.65, type: 'DR' },
  { name: 'M Yamini', opBal: 303272.55, type: 'DR' },
  { name: 'M Yusuf', opBal: 763343.93, type: 'DR' },
  { name: 'Parvathagiri', opBal: 13.20, type: 'DR' },
  { name: 'Pawan', opBal: 603514.45, type: 'DR' },
  { name: 'P M R (Shop)', opBal: 9933816.95, type: 'DR' },
  { name: 'Raju (Ksm)', opBal: 0.40, type: 'DR' },
  { name: 'Redyala New', opBal: 9.90, type: 'DR' },
  { name: 'S Ameer', opBal: 1016331.60, type: 'DR' },
  { name: 'Samshuddin', opBal: 13488.05, type: 'DR' },
  { name: 'Sandralagudem', opBal: 47853.10, type: 'DR' },
  { name: 'S Rmp', opBal: 165780.31, type: 'DR' },
  { name: 'S Sadhik', opBal: 50066.04, type: 'DR' },
  { name: 'S THANDA', opBal: 201269.28, type: 'DR' },
  { name: 'SUNIL PATHIPAKA', opBal: 150753.10, type: 'DR' },
  { name: 'VAVILALA', opBal: 0.00, type: 'DR' },
  { name: 'Yakub (Vemunur)', opBal: 391548.55, type: 'DR' },
  { name: 'Yaswanth Png', opBal: 517149.65, type: 'DR' }
];

const sathishCustomers = [
  { name: 'A', opBal: 128378.05, type: 'DR' },
  { name: 'Balapala', opBal: 43916.65, type: 'DR' },
  { name: 'BANJARA', opBal: 14944.90, type: 'DR' },
  { name: 'B Laxman', opBal: 130360.15, type: 'DR' },
  { name: 'Boring Thanda', opBal: 318886.15, type: 'DR' },
  { name: 'Chilkodu', opBal: 93838.85, type: 'DR' },
  { name: 'D Banu', opBal: 66634.60, type: 'DR' },
  { name: 'D Bhavani', opBal: 523970.85, type: 'DR' },
  { name: 'D Dawood', opBal: 2027223.71, type: 'DR' },
  { name: 'D Javeed', opBal: 99279.15, type: 'DR' },
  { name: 'D Kareem', opBal: 47381.89, type: 'DR' },
  { name: 'D Khaja', opBal: 64014.05, type: 'DR' },
  { name: 'D Kishan', opBal: 90243.10, type: 'DR' },
  { name: 'D Kishore C Thanda', opBal: 10214.50, type: 'DR' },
  { name: 'D KOTI', opBal: 93181.84, type: 'DR' },
  { name: 'D Lambu', opBal: 56611.90, type: 'DR' },
  { name: 'D Munna', opBal: 459622.17, type: 'DR' },
  { name: 'D Naresh', opBal: 122716.50, type: 'DR' },
  { name: 'D Navab', opBal: 3066353.10, type: 'DR' },
  { name: 'D Seetharam', opBal: 114259.15, type: 'DR' },
  { name: 'D Shankar', opBal: 539225.82, type: 'DR' },
  { name: 'Dubbagudem', opBal: 3.20, type: 'CR' },
  { name: 'D Yasin', opBal: 354883.75, type: 'DR' },
  { name: 'G C Sudhakar', opBal: 4349.70, type: 'DR' },
  { name: 'Gollagudem', opBal: 6.70, type: 'DR' },
  { name: 'G Sairam', opBal: 311172.82, type: 'DR' },
  { name: 'Jani (Kmp)', opBal: 54111.00, type: 'DR' },
  { name: 'K Abbas', opBal: 193719.85, type: 'DR' },
  { name: 'Kancharla Gudem', opBal: 30127.90, type: 'DR' },
  { name: 'K BALAJI', opBal: 58222.90, type: 'DR' },
  { name: 'K Dargaiah', opBal: 86597.90, type: 'DR' },
  { name: 'K G N', opBal: 46664.30, type: 'DR' },
  { name: 'K Laxminarayana', opBal: 13949.10, type: 'DR' },
  { name: 'K MALLIKARJUN', opBal: 213409.90, type: 'DR' },
  { name: 'K Narmada', opBal: 605346.63, type: 'DR' },
  { name: 'K Ramana', opBal: 1157786.89, type: 'DR' },
  { name: 'K Ranjith', opBal: 10727.45, type: 'DR' },
  { name: 'K RAVI', opBal: 63605.99, type: 'DR' },
  { name: 'K RENUKA', opBal: 60173.45, type: 'DR' },
  { name: 'K SHIVA', opBal: 123583.95, type: 'DR' },
  { name: 'K Srinu', opBal: 1246400.65, type: 'DR' },
  { name: 'K Suban', opBal: 203517.40, type: 'DR' },
  { name: 'K Upender', opBal: 683003.95, type: 'DR' },
  { name: 'K Venu', opBal: 582721.17, type: 'DR' },
  { name: 'K Vijay', opBal: 16046.24, type: 'DR' },
  { name: 'Latchu Thanda', opBal: 6.80, type: 'DR' },
  { name: 'Mannegudem', opBal: 40002.00, type: 'DR' },
  { name: 'MOGILICHERLA', opBal: 4126.30, type: 'DR' },
  { name: 'N Rabbani', opBal: 75302.00, type: 'DR' },
  { name: 'N Vaheed', opBal: 50202.42, type: 'DR' },
  { name: 'Papaiah (Blp)', opBal: 86980.77, type: 'DR' },
  { name: 'Pullur', opBal: 50033.20, type: 'DR' },
  { name: 'Rajasekhar Kmp', opBal: 539328.89, type: 'DR' },
  { name: 'Ramesh C Thanda', opBal: 91060.35, type: 'DR' },
  { name: 'Ramma (Blp)', opBal: 17082.40, type: 'DR' },
  { name: 'Ravi (C Thanda)', opBal: 83149.85, type: 'DR' },
  { name: 'R R Garla', opBal: 1500922.98, type: 'DR' },
  { name: 'Sai Gc', opBal: 23196.10, type: 'DR' },
  { name: 'Salar Thanda', opBal: 4274.70, type: 'DR' },
  { name: 'Saleem Sankeesa', opBal: 4.00, type: 'CR' },
  { name: 'Suresh (Garla)', opBal: 7.40, type: 'DR' },
  { name: 'Swamy Blp', opBal: 138001.20, type: 'DR' },
  { name: 'Uppalaiah', opBal: 27397.55, type: 'DR' },
  { name: 'Uyyalawada', opBal: 272.10, type: 'CR' },
  { name: 'Veerabhadra', opBal: 33460.35, type: 'DR' },
  { name: 'Veeranna (Upg)', opBal: 44767.97, type: 'DR' },
  { name: 'Venu Upg', opBal: 43.60, type: 'DR' }
];

async function seedCustomers() {
  console.log('[SEED] Seeding real customer accounts with opening balances...');

  // Get group IDs
  const sureshGroup = await pool.query("SELECT id FROM groups WHERE name = 'SURESH GROUP'");
  const sathishGroup = await pool.query("SELECT id FROM groups WHERE name = 'SATHISH GROUP'");

  if (!sureshGroup.rows.length || !sathishGroup.rows.length) {
    console.error('Groups not found. Please ensure groups exist.');
    process.exit(1);
  }

  const sureshGid = sureshGroup.rows[0].id;
  const sathishGid = sathishGroup.rows[0].id;

  let sureshCount = 0;
  for (const c of sureshCustomers) {
    await pool.query(`
      INSERT INTO customers (name, group_id, minus_rate, opening_balance, opening_balance_type)
      VALUES ($1, $2, 0.00, $3, $4)
      ON CONFLICT (name, group_id) DO UPDATE
      SET opening_balance = EXCLUDED.opening_balance,
          opening_balance_type = EXCLUDED.opening_balance_type
    `, [c.name, sureshGid, c.opBal, c.type]);
    sureshCount++;
  }
  console.log(`✓ Seeded ${sureshCount} customers for SURESH GROUP`);

  let sathishCount = 0;
  for (const c of sathishCustomers) {
    await pool.query(`
      INSERT INTO customers (name, group_id, minus_rate, opening_balance, opening_balance_type)
      VALUES ($1, $2, 0.00, $3, $4)
      ON CONFLICT (name, group_id) DO UPDATE
      SET opening_balance = EXCLUDED.opening_balance,
          opening_balance_type = EXCLUDED.opening_balance_type
    `, [c.name, sathishGid, c.opBal, c.type]);
    sathishCount++;
  }
  console.log(`✓ Seeded ${sathishCount} customers for SATHISH GROUP`);

  console.log('[SEED] Complete!');
  process.exit(0);
}

seedCustomers().catch(e => {
  console.error(e);
  process.exit(1);
});
