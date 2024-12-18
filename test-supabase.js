import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://drhgdchrqzidfmhgekva.supabase.co';
// Using service role key to bypass RLS
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyaGdkY2hycXppZGZtaGdla3ZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDU1OTg0NSwiZXhwIjoyMDUwMTM1ODQ1fQ.tiSqJZrt9_lSUd4Q9cI5VuPsE2Uj3yyEFXFPyA8SIOo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        const { data, error } = await supabase
            .from('vector_patterns')
            .select('*')
            .limit(1);

        if (error) throw error;

        console.log('Connection successful. First pattern:', data);
    } catch (error) {
        console.error('Connection failed:', error);
    }
}

testConnection();