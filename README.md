# Sổ chi tiêu — nhập từ điện thoại, lưu vào Google Sheet

App gồm 2 phần:

| Phần | File | Chạy ở đâu |
|---|---|---|
| Giao diện | `index.html` | GitHub Pages (link `…github.io/…`) |
| Đọc/ghi sheet (API) | `Code.gs`, `appsscript.json` | Apps Script của Google Sheet |

Mở app thì giao diện hiện ngay, với số liệu lần trước được lưu trên máy. Khi bấm Lưu, khoản chi hiện ngay trong danh sách, còn việc ghi vào sheet chạy ngầm. Nếu mất mạng, app giữ lại và tự gửi khi có mạng.

## Cài đặt

### 1. Google Sheet + Apps Script
1. Mở Google Sheet, vào **Tiện ích mở rộng › Apps Script**.
2. Dán nội dung [Code.gs](Code.gs) vào file `Code.gs`.
   Nếu trước đây đã tạo file HTML `Index`, **xoá file đó đi** vì giờ không dùng nữa.
3. Vào **⚙ Project Settings**, tick **Show "appsscript.json"**. Mở file đó và dán nội dung [appsscript.json](appsscript.json).
4. Chọn hàm `setup` và bấm **Run**. Lần đầu Google sẽ hỏi quyền: Advanced › Go to … › Allow.
   Hàm này tạo các tab và tạo **mã bí mật**. Sheet cũ đã có dữ liệu cũng chạy an toàn, không mất gì.
5. **Deploy › New deployment › Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**. Người lạ vẫn không vào được, vì API từ chối mọi yêu cầu không có mã bí mật.

   Nếu trước đây đã deploy, vào **Manage deployments › ✏️ › Version: New version** và đổi *Who has access* thành **Anyone**.
6. Chọn hàm `showSetupInfo` và bấm **Run**. Ở **Execution log** bên dưới sẽ hiện 2 dòng: **Mã bí mật** và **URL web app**. Gửi 2 dòng này sang điện thoại, ví dụ qua Ghi chú hoặc Zalo cho chính mình.

### 2. GitHub Pages
1. Repo cần có file **`index.html`**, viết thường. Xoá file `Index.html` cũ nếu còn.
2. Vào **Settings › Pages › Source: Deploy from a branch**, chọn nhánh `main` và thư mục `/ (root)`, rồi Save.
3. Đợi 1–2 phút rồi mở `https://<tên-github>.github.io/<tên-repo>/`.

### 3. Trên điện thoại
1. Mở link GitHub Pages và **Thêm vào Màn hình chính**.
2. **Mở app từ icon trên màn hình chính.** Lần đầu app hiện màn "Kết nối Google Sheet": dán URL web app và mã bí mật rồi bấm **Kết nối**.
   Trên iPhone, app mở từ màn hình chính lưu dữ liệu riêng, tách với Safari. Vì vậy hãy kết nối bên trong app, không phải trong Safari.
3. Muốn đổi kết nối sau này thì bấm ⚙︎ cạnh chữ Balance.

**Nghi lộ mã bí mật?** Chạy hàm `resetToken` rồi nhập mã mới vào app.

## Cập nhật code sau này
- Sửa `index.html`: chỉ cần commit lên GitHub, vài phút sau app tự cập nhật.
- Sửa `Code.gs`: dán lại vào Apps Script, rồi **Deploy › Manage deployments › ✏️ › Version: New version › Deploy**. URL giữ nguyên.

## Dấu hiệu trên app
- **Khoản có viền nét đứt, ghi "Đang lưu…"**: đang gửi lên sheet.
- **⟳ Đang lưu n** (góc trên bên phải): còn n thao tác chưa gửi xong.
- **⚠ Chưa lưu n · thử lại**: không gửi được, thường do mất mạng. App tự thử lại sau 20 giây, hoặc bạn bấm vào để thử ngay. Dữ liệu vẫn nằm trên máy, không mất.

## Quy ước dấu và cách tính

| Màn hình | Dấu − | Dấu + |
|---|---|---|
| Chi tiêu | Khoản chi (mặc định) | Khoản thu hoặc hoàn tiền |
| Lưu động | Tiền ra khỏi ví, chuyển vào nguồn (gửi tiết kiệm, cho vay…) | Tiền vào ví, lấy từ nguồn (rút tiết kiệm, được trả nợ, lương…) |

- **Balance** = balance tháng trước − tổng chi + tiền lưu động.
- **Balance tháng trước** = `OPENING_BALANCE` (tab Cài đặt) cộng mọi giao dịch từ `START_MONTH` đến trước tháng đang xem. App tự tính.
- **Số dư tài sản** = **Số dư ban đầu** (tab Tài sản) − các khoản lưu động có dấu + từ nguồn đó + các khoản có dấu − vào nguồn đó.
- **Thời gian** là lúc bạn bấm Lưu trên điện thoại. Nếu gửi trễ quá 7 ngày thì dùng giờ server.

## Vàng
Mở tab **Tài sản** rồi bấm thẻ **🪙 Vàng**. Mỗi lần mua, bấm **+ Thêm vàng** và nhập ngày mua, số chỉ (được nhập số lẻ như `0,5`), giá mỗi chỉ và ghi chú. App tự tính thành tiền, tổng số chỉ, tổng tiền đã mua và giá vốn trung bình mỗi chỉ.

Dữ liệu nằm ở tab **Vàng** trong sheet. Tab này được tạo tự động ở lần đầu app gọi tới. Mua vàng **không** cộng hay trừ vào Balance. Nếu tiền mua vàng lấy từ ví, hãy ghi thêm một khoản ở Chi tiêu hoặc Lưu động.

## Tuỳ chỉnh mà không cần sửa code

| Muốn làm gì | Sửa ở đâu |
|---|---|
| Thêm, đổi tên, ẩn hoặc sắp xếp danh mục chi | Tab **Danh mục**: cột Tên, Icon (emoji), Màu (mã hex, dùng cho biểu đồ tròn), Đang dùng, Thứ tự |
| Thêm tài sản, đặt số dư ban đầu | Tab **Tài sản**: tick **Bắt buộc ghi chú** để app hỏi thêm ghi chú (như "Khác"); bỏ tick **Theo dõi số dư** nếu không muốn nó hiện ở màn Tài sản |
| Số dư ví ban đầu, tháng bắt đầu, dấu mặc định | Tab **Cài đặt** |
| Sửa hoặc xoá giao dịch cũ | Sửa trực tiếp trên tab **Chi tiêu** hoặc **Lưu động**. Trên app có thể xoá bằng cách bấm × hai lần |

Sửa xong trên sheet thì mở lại app, hoặc chuyển sang app khác rồi quay lại, là app tải bản mới.

**Thêm một trường dữ liệu mới** (ví dụ "Hình thức thanh toán"): thêm key vào `SCHEMA` trong `Code.gs` rồi chạy lại `setup()`. Cột mới được thêm vào sheet có sẵn mà không mất dữ liệu. Để nhập trường đó từ app, thêm ô nhập vào `index.html` và thêm trường đó vào object được lưu trong `addExpense_` / `addTransfer_`. Code tìm cột theo **tiêu đề**, nên bạn có thể đổi thứ tự cột thoải mái, nhưng **đừng đổi tên tiêu đề cột**.
