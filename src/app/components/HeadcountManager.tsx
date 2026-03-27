import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Users, History, TrendingUp, UserPlus, UserMinus } from 'lucide-react';

export function HeadcountManager() {
  const { sections, updateSectionHeadcount } = useApp();

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Workforce Management</h1>
        <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Sectional Headcount Control & History</p>
      </div>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map((s) => (
          <Card key={s.id} className="border-2 shadow-sm hover:shadow-md transition-all overflow-hidden">
            <CardHeader className="bg-slate-50 border-b pb-3">
              <CardTitle className="text-sm font-black flex justify-between items-center uppercase tracking-wider text-slate-700">
                {s.name}
                <div className="p-1.5 bg-white rounded-lg border shadow-sm">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Main Controls */}
              <div className="flex items-center justify-between bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <Button 
                  variant="outline" 
                  className="h-14 w-14 rounded-xl border-red-200 bg-white text-red-600 hover:bg-red-50 shadow-sm"
                  onClick={() => updateSectionHeadcount(s.id, -1)}
                >
                  <UserMinus className="w-6 h-6" />
                </Button>
                
                <div className="text-center">
                  <span className="block text-4xl font-black text-slate-900 leading-none">
                    {s.headcount || 0}
                  </span>
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-2 block">
                    Total Staff
                  </span>
                </div>

                <Button 
                  variant="outline" 
                  className="h-14 w-14 rounded-xl border-green-200 bg-white text-green-600 hover:bg-green-50 shadow-sm"
                  onClick={() => updateSectionHeadcount(s.id, 1)}
                >
                  <UserPlus className="w-6 h-6" />
                </Button>
              </div>

              {/* History Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <History className="w-3 h-3" /> Recent Activity
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {s.headcountHistory && s.headcountHistory.length > 0 ? (
                    [...s.headcountHistory].reverse().slice(0, 5).map((log: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-[10px]">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700">{log.changedBy}</span>
                          <span className="text-slate-400">{new Date(log.date).toLocaleString()}</span>
                        </div>
                        <div className={`font-black px-2 py-1 rounded ${
                          log.newCount > log.prevCount ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                        }`}>
                          {log.prevCount} → {log.newCount}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-4 text-[10px] text-slate-400 italic">No history recorded yet</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}