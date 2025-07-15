const { createClient } = require('@supabase/supabase-js');

// 使用 DouCoachSystem 的 Supabase 連線
const supabaseUrl = 'https://urryrxlzyepwklzwwxwa.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
    console.log('🔍 Getting students data from DouCoachSystem');
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'Method not allowed' 
            })
        };
    }

    try {
        console.log('🔍 Connecting to DouCoachSystem dnawakes schema...');
        
        // 使用 RPC 函數取得待處理報告列表
        const { data: orders, error: orderError } = await supabase
            .rpc('dnawakes_get_pending_reports');

        if (orderError) {
            console.error('❌ Database query error:', orderError);
            throw new Error(`Database error: ${orderError.message}`);
        }

        console.log(`📋 Found ${orders?.length || 0} orders from database`);

        // 轉換資料格式以符合前端期望
        const students = (orders || []).map(order => ({
            id: order.order_id,
            orderNumber: order.order_number,
            name: order.buyer_name,
            email: order.buyer_email,
            amount: order.amount,
            plan: order.plan_type,
            birthDate: order.birth_date,
            createdAt: order.created_at,
            reportStatus: order.report_status || 'pending'
        }));

        console.log(`✅ Successfully transformed ${students.length} student records`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                students: students,
                count: students.length,
                message: 'Real data loaded from DouCoachSystem dnawakes schema'
            })
        };

    } catch (error) {
        console.error('❌ Error fetching students:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message || 'Internal server error'
            })
        };
    }
};