import { useState, useEffect } from 'react';
import { db, auth } from '../../firebase'; //
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore'; //
import { sendPasswordResetEmail } from 'firebase/auth'; //
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Trash2, UserPlus, ShieldCheck, Mail } from 'lucide-react';

export function UserManagement() {
  const [staff, setStaff] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState(''); // New state for password
  const [role, setRole] = useState<'ADMIN' | 'USER'>('USER');

  // 1. Fetch all users from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, []);

  // 2. Add New User Logic
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Logic for document creation in Firestore
      const newUserRef = doc(collection(db, "users"));
      await setDoc(newUserRef, {
        name,
        email,
        role,
        createdAt: new Date().toISOString()
      });
      
      alert("User profile created! Note: Password must be managed via Firebase Auth or the Reset Email button.");
      setEmail(''); 
      setName('');
      setPassword('');
    } catch (error) {
      console.error("Error adding user:", error);
    }
  };

  // 3. Send Password Reset Email Logic
  const handleResetPassword = async (userEmail: string) => {
    try {
      await sendPasswordResetEmail(auth, userEmail); //
      alert(`Password reset email sent to ${userEmail}`);
    } catch (error) {
      console.error("Error sending reset email:", error);
      alert("Failed to send reset email. Ensure the user exists in Firebase Authentication.");
    }
  };

  const deleteUser = async (id: string) => {
    if (confirm("Delete this user?")) {
      await deleteDoc(doc(db, "users", id)); //
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Staff Management</h1>
        <div className="flex items-center gap-2 text-blue-600">
          <ShieldCheck className="w-6 h-6" />
          <span className="font-semibold">Admin Control Panel</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Registration Form */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Add New Staff</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email (User ID)</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              {/* New Password Input Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Initial Password</label>
                <Input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Min 6 characters"
                  required 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">System Role</label>
                <Select value={role} onValueChange={(val: any) => setRole(val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">Operator (Scan Only)</SelectItem>
                    <SelectItem value="ADMIN">Administrator (Full Access)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">
                <UserPlus className="w-4 h-4 mr-2" /> Register Staff
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* User List Table */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Active Users</CardTitle></CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-[10px] text-white font-bold ${
                          u.role === 'ADMIN' ? 'bg-purple-600' : 'bg-blue-500'
                        }`}>
                          {u.role}
                        </span>
                      </TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        {/* New Password Reset Button */}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleResetPassword(u.email)}
                          title="Send Password Reset Email"
                        >
                          <Mail className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteUser(u.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}