const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// 使用 DouCoachSystem 的 Supabase 連線
const supabaseUrl = 'https://urryrxlzyepwklzwwxwa.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
    console.log('🔥 Isis Report Generator Started');
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    if (event.httpMethod !== 'POST') {
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
        const { student, reportContent, password } = JSON.parse(event.body);
        
        console.log('📋 Processing report for:', student.name);

        // 驗證必要資料
        if (!student || !reportContent || !password) {
            throw new Error('Missing required data');
        }

        // 生成 PDF 報告
        const pdfBase64 = await generatePDF(student, reportContent, password);
        
        // 觸發 n8n webhook 發送郵件
        await triggerN8nWebhook({
            orderNumber: student.orderNumber,
            studentName: student.name,
            studentEmail: student.email,
            planType: student.plan,
            pdfBase64: pdfBase64,
            password: password,
            reportDate: new Date().toISOString()
        });

        // 更新報告狀態為已發送
        await updateReportStatus(student.orderNumber, 'sent');

        // 記錄到資料庫 (可選)
        await logReportGeneration(student, reportContent);

        console.log('✅ Report generated and sent successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'PDF報告已生成並發送',
                orderNumber: student.orderNumber
            })
        };

    } catch (error) {
        console.error('❌ Error generating report:', error);
        
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

// 生成 PDF 函數
async function generatePDF(student, reportContent, password) {
    const PDFDocument = require('pdfkit');
    
    return new Promise((resolve, reject) => {
        try {
            console.log('📄 Generating PDF for:', student.name);
            
            // 創建 PDF 文檔
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 50, bottom: 50, left: 50, right: 50 },
                info: {
                    Title: `Isis DNA覺醒報告 - ${student.name}`,
                    Author: 'Isis 女神',
                    Subject: 'DNA財富覺醒報告',
                    Creator: 'Isis DNA覺醒系統'
                }
                // Note: 密碼保護功能在 Netlify Functions 中可能不支援，先移除
            });

            const chunks = [];
            
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                const pdfBase64 = pdfBuffer.toString('base64');
                resolve(pdfBase64);
            });

            // PDF 樣式設定
            const primaryColor = '#4A148C';
            const goldColor = '#FFD700';
            const textColor = '#333333';

            // 標題頁 - 使用系統預設字體
            doc.fontSize(28)
               .fillColor(primaryColor)
               .text('✨ Isis DNA覺醒 ✨', { align: 'center' });

            doc.moveDown();
            doc.fontSize(22)
               .fillColor(goldColor)
               .text('財富DNA編碼報告', { align: 'center' });

            doc.moveDown(2);

            // 學員資訊框
            const infoBoxY = doc.y;
            doc.rect(50, infoBoxY, 495, 120)
               .fillAndStroke('#f8f9fa', '#ddd');

            doc.fontSize(16)
               .fillColor(textColor)
               .text('👤 學員資訊', 70, infoBoxY + 20);

            doc.fontSize(12)
               .text(`姓名：${student.name}`, 70, infoBoxY + 50)
               .text(`方案：${student.plan}`, 70, infoBoxY + 70)
               .text(`生成日期：${new Date().toLocaleDateString('zh-TW')}`, 70, infoBoxY + 90);

            // 浮水印 - 學員姓名
            doc.fontSize(60)
               .fillColor('#f0f0f0')
               .text(student.name, 0, 400, {
                   align: 'center',
                   opacity: 0.1
               });

            // 新頁面開始報告內容
            doc.addPage();

            // 報告內容標題
            doc.fontSize(20)
               .fillColor(primaryColor)
               .text('🌟 您專屬的財富DNA報告', { align: 'center' });

            doc.moveDown(2);

            // 處理報告內容
            const sections = reportContent.split('========================');
            
            sections.forEach((section, index) => {
                if (section.trim()) {
                    const lines = section.trim().split('\n');
                    const title = lines[0];
                    const content = lines.slice(1).join('\n').trim();

                    if (title && content) {
                        // 檢查是否需要新頁面
                        if (doc.y > 700) {
                            doc.addPage();
                        }

                        // 章節標題
                        doc.fontSize(16)
                           .fillColor(goldColor)
                           .text(title, { align: 'left' });

                        doc.moveDown(0.5);

                        // 章節內容
                        doc.fontSize(11)
                           .fillColor(textColor)
                           .text(content, {
                               align: 'justify',
                               lineGap: 3
                           });

                        doc.moveDown(1.5);
                    }
                }
            });

            // 頁腳
            const pageCount = doc.bufferedPageRange().count;
            for (let i = 0; i < pageCount; i++) {
                doc.switchToPage(i);
                
                // 頁碼
                doc.fontSize(10)
                   .fillColor('#666')
                   .text(`第 ${i + 1} 頁，共 ${pageCount} 頁`, 
                          50, doc.page.height - 30, 
                          { align: 'center' });

                // 版權資訊
                if (i === 0) {
                    doc.text('© 2025 Isis 女神 - 此報告為個人專屬，請勿分享',
                             50, doc.page.height - 50,
                             { align: 'center' });
                }
            }

            doc.end();

        } catch (error) {
            console.error('PDF generation error:', error);
            reject(error);
        }
    });
}

// 觸發 n8n webhook
async function triggerN8nWebhook(data) {
    const webhookUrl = process.env.N8N_WEBHOOK_URL || 'https://n8n-samson-lin-u44764.vm.elestio.app/webhook/send-isis-report-email';
    
    console.log('📧 Triggering n8n webhook for email sending');
    
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`n8n webhook failed: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ n8n webhook triggered successfully');
        return result;

    } catch (error) {
        console.error('❌ n8n webhook error:', error);
        throw error;
    }
}

// 更新報告狀態
async function updateReportStatus(orderNumber, status) {
    try {
        console.log(`📝 Updating report status for order ${orderNumber} to ${status}`);
        
        const { data, error } = await supabase
            .rpc('dnawakes_update_report_status', {
                p_order_number: orderNumber,
                p_status: status
            });

        if (error) {
            console.error('❌ Error updating report status:', error);
            // 不拋出錯誤，因為這不是關鍵功能
        } else {
            console.log('✅ Report status updated successfully');
        }
    } catch (error) {
        console.error('❌ Error updating report status:', error);
    }
}

// 記錄報告生成
async function logReportGeneration(student, reportContent) {
    try {
        const { data, error } = await supabase
            .from('isis_report_logs')
            .insert([
                {
                    order_number: student.orderNumber,
                    student_name: student.name,
                    student_email: student.email,
                    plan_type: student.plan,
                    report_content_length: reportContent.length,
                    generated_at: new Date().toISOString(),
                    status: 'completed'
                }
            ]);

        if (error) {
            console.error('Database logging error:', error);
            // 不拋出錯誤，因為這不是關鍵功能
        } else {
            console.log('📝 Report generation logged to database');
        }
    } catch (error) {
        console.error('Database logging error:', error);
    }
}