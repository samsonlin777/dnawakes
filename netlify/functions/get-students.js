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
        // 查詢付款完成的學員
        const { data: orders, error: orderError } = await supabase
            .from('dnawakes.payment_orders')
            .select(`
                id,
                order_number,
                buyer_name,
                buyer_email,
                amount,
                plan_type,
                created_at,
                customer_id
            `)
            .eq('payment_status', 'completed')
            .in('plan_type', ['暴富方案一', '暴富方案二', '暴富方案三'])
            .order('created_at', { ascending: false });

        if (orderError) {
            console.error('Order query error:', orderError);
            throw new Error('Failed to fetch orders');
        }

        console.log(`📋 Found ${orders.length} completed orders`);

        // 獲取客戶詳細資訊
        const studentsWithDetails = await Promise.all(
            orders.map(async (order) => {
                let birthDate = null;
                
                if (order.customer_id) {
                    try {
                        const { data: customer, error: customerError } = await supabase
                            .from('dnawakes.customers')
                            .select('custom_fields')
                            .eq('id', order.customer_id)
                            .single();

                        if (!customerError && customer && customer.custom_fields) {
                            birthDate = customer.custom_fields.birth_date;
                        }
                    } catch (error) {
                        console.log(`Customer details not found for order ${order.order_number}`);
                    }
                }

                return {
                    id: order.id,
                    orderNumber: order.order_number,
                    name: order.buyer_name,
                    email: order.buyer_email,
                    amount: order.amount,
                    plan: order.plan_type,
                    birthDate: birthDate,
                    createdAt: order.created_at,
                    reportStatus: 'pending' // 可以後續從報告記錄表查詢
                };
            })
        );

        console.log('✅ Students data processed successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                students: studentsWithDetails,
                count: studentsWithDetails.length
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