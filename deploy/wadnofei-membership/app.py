from flask import Flask,request,redirect,session,render_template_string,flash,url_for
import sqlite3,os,secrets
from datetime import timedelta
from werkzeug.security import generate_password_hash,check_password_hash

BASE='/opt/wadnofei-membership'
DB=os.path.join(BASE,'members.db')
SECRET_FILE=os.path.join(BASE,'.secret')
os.makedirs(BASE,exist_ok=True)
if not os.path.exists(SECRET_FILE):
    with open(SECRET_FILE,'w') as f: f.write(secrets.token_hex(32))
    os.chmod(SECRET_FILE,0o600)
with open(SECRET_FILE) as f: SECRET=f.read().strip()

app=Flask(__name__)
app.secret_key=SECRET
app.permanent_session_lifetime=timedelta(hours=8)
app.config.update(SESSION_COOKIE_HTTPONLY=True,SESSION_COOKIE_SAMESITE='Lax',SESSION_COOKIE_SECURE=True)

def db():
    c=sqlite3.connect(DB); c.row_factory=sqlite3.Row; return c

def addcol(c,table,col,definition):
    cols={r['name'] for r in c.execute(f'PRAGMA table_info({table})')}
    if col not in cols: c.execute(f'ALTER TABLE {table} ADD COLUMN {col} {definition}')

def init():
    c=db()
    c.executescript('''
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE,password TEXT);
    CREATE TABLE IF NOT EXISTS members(id INTEGER PRIMARY KEY AUTOINCREMENT,member_no TEXT UNIQUE,name TEXT NOT NULL,phone TEXT,address TEXT,status TEXT DEFAULT 'active',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY AUTOINCREMENT,member_id INTEGER,amount REAL,receipt TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    ''')
    addcol(c,'members','dob','TEXT'); addcol(c,'members','job','TEXT'); addcol(c,'members','member_type','TEXT DEFAULT "عضو عامل"'); addcol(c,'members','notes','TEXT')
    addcol(c,'payments','kind','TEXT DEFAULT "اشتراك عضوية"'); addcol(c,'payments','period','TEXT')
    if not c.execute('SELECT 1 FROM users').fetchone():
        c.execute('INSERT INTO users(username,password) VALUES(?,?)',('admin',generate_password_hash('ChangeMe123!')))
    c.commit(); c.close()

STYLE='''<style>
:root{--b:#234890;--g:#d8ae43;--bg:#f4f6fa;--line:#e3e8f0}*{box-sizing:border-box}body{font-family:Tahoma,Arial;background:var(--bg);margin:0;color:#172033}header{background:var(--b);color:#fff;padding:24px}header .x,main{max-width:1050px;margin:auto}header h1{margin:0 0 6px;font-size:27px}main{padding:16px}.card,.stat{background:#fff;border:1px solid var(--line);padding:16px;border-radius:15px;margin:12px 0}.nav{display:flex;gap:8px;flex-wrap:wrap}.nav a,.btn,button{display:inline-block;padding:10px 13px;border-radius:9px;text-decoration:none;border:0;font:inherit;cursor:pointer}.nav a,.btn{background:#fff;border:1px solid var(--line);color:var(--b)}button,.primary{background:var(--b)!important;color:#fff!important}.gold{background:var(--g)!important;color:#172033!important}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.stat b{font-size:25px;display:block}.form{display:grid;grid-template-columns:1fr 1fr;gap:10px}.form label{font-weight:bold}input,select,textarea{width:100%;padding:10px;border:1px solid #cfd6e1;border-radius:8px;margin-top:5px;font:inherit}.full{grid-column:1/-1}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid var(--line);text-align:right}.flash{background:#fff2c7;padding:10px;border-radius:9px;margin:10px 0}.badge{background:#edf2fa;padding:4px 8px;border-radius:20px}.card-id{background:var(--b);color:white;border-bottom:7px solid var(--g);max-width:430px}.muted{color:#667085}@media(max-width:700px){.grid{grid-template-columns:1fr 1fr}.form{grid-template-columns:1fr}}@media(max-width:430px){.grid{grid-template-columns:1fr}}
</style>'''
PAGE='''<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>عضوية نادي ود نفيع</title>'''+STYLE+'''</head><body><header><div class="x"><h1>نادي ود نفيع الرياضي الثقافي الاجتماعي</h1><div>نظام العضوية المركزي — تأسس عام 1964</div></div></header><main>{% with ms=get_flashed_messages() %}{% for m in ms %}<div class="flash">{{m}}</div>{% endfor %}{% endwith %}{{body|safe}}</main></body></html>'''

def need_login(): return not session.get('u')
def esc(s):
    return str(s or '').replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;')
def label(s): return {'active':'نشطة','late':'متأخرة','suspended':'معلقة','resigned':'مستقيل'}.get(s,s)

def nav(): return '<div class="card nav"><a href="/dashboard">الرئيسية</a><a href="/new">تسجيل عضو</a><a href="/payments">الاشتراكات</a><a href="/change-password">تغيير كلمة المرور</a><a href="/logout">خروج</a></div>'

@app.route('/',methods=['GET','POST'])
def login():
    if session.get('u'): return redirect('/dashboard')
    msg=''
    if request.method=='POST':
        c=db(); u=c.execute('SELECT * FROM users WHERE username=?',(request.form['u'].strip(),)).fetchone(); c.close()
        if u and check_password_hash(u['password'],request.form['p']):
            session.clear(); session.permanent=True; session['u']=u['username']; session['uid']=u['id']; return redirect('/dashboard')
        msg='بيانات الدخول غير صحيحة'
    b=f'''<div class="card" style="max-width:470px;margin:30px auto"><h2>تسجيل الدخول</h2><form method="post"><label>اسم المستخدم<input name="u" required></label><br><label>كلمة المرور<input type="password" name="p" required></label><br><button>دخول</button></form><p>{msg}</p></div>'''
    return render_template_string(PAGE,body=b)

@app.route('/dashboard')
def dashboard():
    if need_login(): return redirect('/')
    q=request.args.get('q','').strip(); c=db()
    stats={'total':c.execute('SELECT COUNT(*) n FROM members').fetchone()['n'],'active':c.execute("SELECT COUNT(*) n FROM members WHERE status='active'").fetchone()['n'],'late':c.execute("SELECT COUNT(*) n FROM members WHERE status='late'").fetchone()['n'],'money':c.execute('SELECT COALESCE(SUM(amount),0) n FROM payments').fetchone()['n']}
    if q:
        like=f'%{q}%'; members=c.execute('SELECT * FROM members WHERE name LIKE ? OR phone LIKE ? OR member_no LIKE ? ORDER BY id DESC',(like,like,like)).fetchall()
    else: members=c.execute('SELECT * FROM members ORDER BY id DESC').fetchall()
    c.close()
    rows=''.join(f"<tr><td><a href='/member/{m['id']}'>{esc(m['member_no'])}</a></td><td>{esc(m['name'])}</td><td>{esc(m['phone'])}</td><td><span class='badge'>{label(m['status'])}</span></td></tr>" for m in members)
    b=nav()+f'''<div class="grid"><div class="stat">إجمالي الأعضاء<b>{stats['total']}</b></div><div class="stat">نشطون<b>{stats['active']}</b></div><div class="stat">متأخرون<b>{stats['late']}</b></div><div class="stat">إجمالي التحصيل<b>{stats['money']:.2f}</b></div></div><div class="card"><form><input name="q" value="{esc(q)}" placeholder="بحث بالاسم أو الرقم أو الهاتف"><button>بحث</button></form></div><div class="card"><h3>الأعضاء ({len(members)})</h3><div style="overflow:auto"><table><tr><th>الرقم</th><th>الاسم</th><th>الهاتف</th><th>الحالة</th></tr>{rows}</table></div></div>'''
    return render_template_string(PAGE,body=b)

@app.route('/new',methods=['GET','POST'])
def new():
    if need_login(): return redirect('/')
    if request.method=='POST':
        c=db(); n=c.execute('SELECT COALESCE(MAX(id),0)+1 n FROM members').fetchone()['n']; no=f'WDN-{n:04d}'
        c.execute('INSERT INTO members(member_no,name,phone,address,status,dob,job,member_type,notes) VALUES(?,?,?,?,?,?,?,?,?)',(no,request.form['name'].strip(),request.form.get('phone','').strip(),request.form.get('address','').strip(),'active',request.form.get('dob',''),request.form.get('job','').strip(),request.form.get('member_type','عضو عامل'),request.form.get('notes','').strip()))
        mid=c.execute('SELECT last_insert_rowid() id').fetchone()['id']; c.commit(); c.close(); flash(f'تم تسجيل العضو برقم {no}'); return redirect(f'/member/{mid}')
    b=nav()+'''<div class="card"><h2>تسجيل عضو جديد</h2><form method="post" class="form"><label>الاسم الرباعي<input name="name" required></label><label>رقم الهاتف<input name="phone"></label><label>تاريخ الميلاد<input type="date" name="dob"></label><label>السكن<input name="address"></label><label>المهنة<input name="job"></label><label>نوع العضوية<select name="member_type"><option>عضو عامل</option><option>عضو منتسب</option><option>عضو فخري</option></select></label><label class="full">ملاحظات<textarea name="notes"></textarea></label><div class="full"><button>حفظ العضوية</button></div></form></div>'''
    return render_template_string(PAGE,body=b)

@app.route('/member/<int:mid>',methods=['GET','POST'])
def member(mid):
    if need_login(): return redirect('/')
    c=db(); m=c.execute('SELECT * FROM members WHERE id=?',(mid,)).fetchone()
    if not m: c.close(); return 'غير موجود',404
    if request.method=='POST':
        st=request.form.get('status','active')
        if st in ('active','late','suspended','resigned'): c.execute('UPDATE members SET status=? WHERE id=?',(st,mid)); c.commit(); flash('تم تحديث حالة العضوية')
        c.close(); return redirect(f'/member/{mid}')
    pays=c.execute('SELECT * FROM payments WHERE member_id=? ORDER BY id DESC',(mid,)).fetchall(); total=c.execute('SELECT COALESCE(SUM(amount),0) n FROM payments WHERE member_id=?',(mid,)).fetchone()['n']; c.close()
    prows=''.join(f"<tr><td>{esc(p['created_at'])}</td><td>{esc(p['kind'])}</td><td>{p['amount']:.2f}</td><td>{esc(p['receipt'])}</td></tr>" for p in pays)
    b=nav()+f'''<div class="card card-id"><h2>{esc(m['name'])}</h2><h3>{esc(m['member_no'])}</h3><p>{esc(m['member_type'])} — {label(m['status'])}</p></div><div class="card"><p>الهاتف: {esc(m['phone']) or '-'}</p><p>السكن: {esc(m['address']) or '-'}</p><p>المهنة: {esc(m['job']) or '-'}</p><p>إجمالي المدفوع: <b>{total:.2f}</b></p><form method="post"><select name="status"><option value="active">نشطة</option><option value="late">متأخرة</option><option value="suspended">معلقة</option><option value="resigned">مستقيل</option></select><button class="gold">تغيير الحالة</button></form></div><div class="card"><a class="primary btn" href="/payments?member_id={mid}">تسجيل دفعة لهذا العضو</a><h3>سجل المدفوعات</h3><div style="overflow:auto"><table><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>الإيصال</th></tr>{prows}</table></div></div>'''
    return render_template_string(PAGE,body=b)

@app.route('/payments',methods=['GET','POST'])
def payments():
    if need_login(): return redirect('/')
    c=db()
    if request.method=='POST':
        try:
            c.execute('INSERT INTO payments(member_id,amount,receipt,kind,period) VALUES(?,?,?,?,?)',(int(request.form['member_id']),float(request.form['amount']),request.form['receipt'].strip(),request.form.get('kind','اشتراك عضوية'),request.form.get('period','').strip())); c.commit(); flash('تم تسجيل الدفعة')
        except Exception as e: flash('تعذر تسجيل الدفعة: تحقق من البيانات')
        c.close(); return redirect('/payments')
    ms=c.execute('SELECT id,member_no,name FROM members ORDER BY name').fetchall(); rows=c.execute('SELECT p.*,m.name,m.member_no FROM payments p JOIN members m ON m.id=p.member_id ORDER BY p.id DESC LIMIT 100').fetchall(); c.close()
    selected=request.args.get('member_id','')
    opts=''.join(f"<option value='{m['id']}' {'selected' if str(m['id'])==selected else ''}>{esc(m['member_no'])} — {esc(m['name'])}</option>" for m in ms)
    prows=''.join(f"<tr><td>{esc(p['created_at'])}</td><td>{esc(p['member_no'])} — {esc(p['name'])}</td><td>{esc(p['kind'])}</td><td>{p['amount']:.2f}</td><td>{esc(p['receipt'])}</td></tr>" for p in rows)
    b=nav()+f'''<div class="card"><h2>تسجيل دفعة</h2><form method="post" class="form"><label>العضو<select name="member_id" required><option value="">اختر العضو</option>{opts}</select></label><label>النوع<select name="kind"><option>اشتراك عضوية</option><option>رسم تسجيل</option><option>تبرع</option><option>أخرى</option></select></label><label>المبلغ<input type="number" step="0.01" min="0" name="amount" required></label><label>رقم الإيصال<input name="receipt" required></label><label class="full">الفترة / البيان<input name="period"></label><div class="full"><button>حفظ الدفعة</button></div></form></div><div class="card"><h3>آخر المدفوعات</h3><div style="overflow:auto"><table><tr><th>التاريخ</th><th>العضو</th><th>النوع</th><th>المبلغ</th><th>الإيصال</th></tr>{prows}</table></div></div>'''
    return render_template_string(PAGE,body=b)

@app.route('/change-password',methods=['GET','POST'])
def change_password():
    if need_login(): return redirect('/')
    if request.method=='POST':
        old=request.form['old']; new=request.form['new']; confirm=request.form['confirm']; c=db(); u=c.execute('SELECT * FROM users WHERE id=?',(session['uid'],)).fetchone()
        if not u or not check_password_hash(u['password'],old): flash('كلمة المرور الحالية غير صحيحة')
        elif len(new)<10: flash('كلمة المرور الجديدة يجب ألا تقل عن 10 أحرف')
        elif new!=confirm: flash('تأكيد كلمة المرور غير مطابق')
        else:
            c.execute('UPDATE users SET password=? WHERE id=?',(generate_password_hash(new),session['uid'])); c.commit(); session.clear(); c.close(); flash('تم تغيير كلمة المرور. سجّل الدخول بالكلمة الجديدة.'); return redirect('/')
        c.close()
    b=nav()+'''<div class="card" style="max-width:560px"><h2>تغيير كلمة المرور</h2><form method="post"><label>كلمة المرور الحالية<input type="password" name="old" required></label><br><label>كلمة المرور الجديدة<input type="password" name="new" minlength="10" required></label><br><label>تأكيد كلمة المرور<input type="password" name="confirm" minlength="10" required></label><br><button>حفظ كلمة المرور الجديدة</button></form></div>'''
    return render_template_string(PAGE,body=b)

@app.route('/logout')
def logout(): session.clear(); return redirect('/')

init()
