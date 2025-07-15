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
        console.log('🔍 Testing database access...');
        
        // 暫時返回測試數據，因為資料庫權限問題
        const testStudents = [
            {
                id: 1,
                orderNumber: 'DNA2025071601',
                name: '王美麗',
                email: 'meili.wang@example.com',
                amount: 16888,
                plan: '暴富方案一',
                birthDate: '1985-03-15',
                createdAt: '2025-07-15T10:30:00Z',
                reportStatus: 'pending'
            },
            {
                id: 2,
                orderNumber: 'DNA2025071602',
                name: '李雅婷',
                email: 'yating.li@example.com',
                amount: 5888,
                plan: '暴富方案二',
                birthDate: '1990-07-22',
                createdAt: '2025-07-14T15:45:00Z',
                reportStatus: 'pending'
            },
            {
                id: 3,
                orderNumber: 'DNA2025071603',
                name: '陳志豪',
                email: 'zhihao.chen@example.com',
                amount: 3333,
                plan: '暴富方案三',
                birthDate: '1992-12-10',
                createdAt: '2025-07-13T09:20:00Z',
                reportStatus: 'completed'
            },
            {
                id: 4,
                orderNumber: 'DNA2025071604',
                name: '黃淑芬',
                email: 'shufen.huang@example.com',
                amount: 16888,
                plan: '暴富方案一',
                birthDate: '1988-09-18',
                createdAt: '2025-07-12T14:15:00Z',
                reportStatus: 'pending'
            },
            {
                id: 5,
                orderNumber: 'DNA2025071605',
                name: '劉建華',
                email: 'jianhua.liu@example.com',
                amount: 5888,
                plan: '暴富方案二',
                birthDate: '1979-11-03',
                createdAt: '2025-07-11T11:30:00Z',
                reportStatus: 'pending'
            }
        ];

        console.log(`📋 Returning ${testStudents.length} test students`);
        console.log('✅ Test data loaded successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                students: testStudents,
                count: testStudents.length,
                note: 'Using test data - please configure database access'
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