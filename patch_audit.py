import re

with open("client/src/pages/SiteAdmin.tsx", "r", encoding="utf-8") as f:
    content = f.read()

audit_ui = """
          <TabsContent value="audit" className="mt-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-500" />
                Admin Audit Log
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Recent administrative actions taken on the platform.</p>
              
              <div className="space-y-4">
                {[
                  { action: 'Approved Match #1042', admin: 'System', time: '10 mins ago', type: 'approve' },
                  { action: 'Deleted Suspicious Match #1041', admin: 'You', time: '1 hour ago', type: 'delete' },
                  { action: 'Updated Site Announcements', admin: 'You', time: '2 hours ago', type: 'edit' },
                  { action: 'Approved Player: Raj', admin: 'System', time: '1 day ago', type: 'approve' }
                ].map((log, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${log.type === 'delete' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' : log.type === 'approve' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                        {log.type === 'delete' ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{log.action}</div>
                        <div className="text-xs font-bold text-slate-400">by {log.admin}</div>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-slate-400">{log.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
"""

content = content.replace("<TabsList className=\"w-full max-w-2xl mx-auto grid grid-cols-4\">", "<TabsList className=\"w-full max-w-3xl mx-auto grid grid-cols-5\">")
content = content.replace("<TabsTrigger value=\"events\" className=\"rounded-xl font-bold\">Events</TabsTrigger>", "<TabsTrigger value=\"events\" className=\"rounded-xl font-bold\">Events</TabsTrigger>\n            <TabsTrigger value=\"audit\" className=\"rounded-xl font-bold\">Audit Log</TabsTrigger>")
content = content.replace("</Tabs>", audit_ui + "\n        </Tabs>")

with open("client/src/pages/SiteAdmin.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("SiteAdmin.tsx updated with Audit Logs.")
