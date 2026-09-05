from flask import Flask,request,redirect,session,render_template_string
import sqlite3,os
from werkzeug.security import generate_password_hash,check_password_hash

app=Flask(__name__)
app.secret_key=os.environ.get('SECRET_KEY','change-this-secret')
DB='/opt/wadnofei-membership/members.db'

def db():
    c=sqlite3.connect(DB); c.row_factory=sqlite3.Row; return c

def init():
    c=db()
    c.executescript('''
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE,password TEXT);
    CREATE TABLE IF NOT EXISTS members(id INTEGER PRIMARY KEY AUTOINCREMENT,member_no TEXT UNIQUE,name TEXT NOT NULL,phone TEXT,address TEXT,status TEXT DEFAULT 'active',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY AUTOINCREMENT,member_id INTEGER,amount REAL,receipt TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    ''')
    if not c.execute('SELECT 1 FROM users').fetchone():
        c.execute('INSERT INTO users(username,password) VALUES(?,?)',('admin',generate_password_hash('ChangeMe123!')))
    c.commit(); c.close()

PAGE='''<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>عضوية نادي ود نفيع</title><style>body{font-family:Tahoma;background:#f5f7fb;margin:0;color:#172033}header{background:#173f8a;color:white;padding:20px}main{max-width:900px;margin:auto;padding:15px}.card{background:white;padding:15px;border-radius:14px;margin:12px 0}input,select,button{padding:10px;margin:5px;border-radius:8px;border:1px solid #ddd}button{background:#173f8a;color:white}a{color:#173f8a}table{width:100%;border-collapse:collapse}td,th{padding:9px;border-bottom:1px solid #eee;text-align:right}</style></head><body><header><h2>نادي ود نفيع الرياضي الثقافي الاجتماعي</h2>نظام العضوية</header><main>{{body|safe}}</main></body></html>'''

@app.route('/',methods=['GET','POST'])
def login():
    if session.get('u'): return redirect('/dashboard')
    msg=''
    if request.method=='POST':
        c=db(); u=c.execute('SELECT * FROM users WHERE username=?',(request.form['u'],)).fetchone(); c.close()
        if u and check_password_hash(u['password'],request.form['p']):
            session['u']=u['username']; return redirect('/dashboard')
        msg='بيانات الدخول غير صحيحة'
    b=f'''<div class="card"><h3>تسجيل الدخول</h3><form method="post"><input name="u" placeholder="اسم المستخدم" required><br><input type="password" name="p" placeholder="كلمة المرور" required><br><button>دخول</button></form><p>{msg}</p></div>'''
    return render_template_string(PAGE,body=b)

@app.route('/dashboard')
def dashboard():
    if not session.get('u'): return redirect('/')
    c=db(); members=c.execute('SELECT * FROM members ORDER BY id DESC').fetchall()
    rows=''.join(f"<tr><td>{m['member_no']}</td><td>{m['name']}</td><td>{m['phone'] or ''}</td><td>{m['status']}</td></tr>" for m in members)
    b=f'''<div class="card"><a href="/new">+ تسجيل عضو جديد</a> | <a href="/logout">خروج</a></div><div class="card"><h3>الأعضاء ({len(members)})</h3><table><tr><th>الرقم</th><th>الاسم</th><th>الهاتف</th><th>الحالة</th></tr>{rows}</table></div>'''
    c.close(); return render_template_string(PAGE,body=b)

@app.route('/new',methods=['GET','POST'])
def new():
    if not session.get('u'): return redirect('/')
    if request.method=='POST':
        c=db(); n=c.execute('SELECT COALESCE(MAX(id),0)+1 FROM members').fetchone()[0]; no=f'WDN-{n:04d}'
        c.execute('INSERT INTO members(member_no,name,phone,address,status) VALUES(?,?,?,?,?)',(no,request.form['name'],request.form.get('phone',''),request.form.get('address',''),'active'))
        c.commit(); c.close(); return redirect('/dashboard')
    b='''<div class="card"><h3>تسجيل عضو جديد</h3><form method="post"><input name="name" placeholder="الاسم الرباعي" required><br><input name="phone" placeholder="رقم الهاتف"><br><input name="address" placeholder="السكن"><br><button>حفظ العضوية</button></form></div>'''
    return render_template_string(PAGE,body=b)

@app.route('/logout')
def logout():
    session.clear(); return redirect('/')

init()
