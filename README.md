# Sổ chi tiêu — nhập từ điện thoại, lưu vào Google Sheet

Web app chạy bằng Google Apps Script, gắn vào một Google Sheet mới. Bạn mở link trên trình duyệt điện thoại để nhập, còn toàn bộ dữ liệu vẫn nằm trong sheet. Không cần server và không tốn phí.

## Cài đặt (khoảng 5 phút, làm một lần)

1. Mở **sheets.new** để tạo Google Sheet mới, rồi đặt tên, ví dụ "Sổ chi tiêu".
2. Vào menu **Tiện ích mở rộng › Apps Script** (Extensions › Apps Script).
3. Trong trình soạn thảo:
   - Xoá hết nội dung file `Code.gs` mặc định và dán nội dung file [Code.gs](Code.gs) vào.
   - Bấm **+ › HTML**, đặt tên đúng là `Index` rồi dán nội dung file [Index.html](Index.html).
   - Vào **⚙ Project Settings**, tick **Show "appsscript.json"**. Quay lại Editor, mở `appsscript.json` và dán nội dung file [appsscript.json](appsscript.json). File này đặt múi giờ Việt Nam.
4. Chọn hàm `setup` trên thanh công cụ và bấm **Run**. Lần đầu Google sẽ hỏi quyền: chọn tài khoản › Advanced › Go to … (unsafe) › Allow. Đây là script của chính bạn nên cảnh báo này là bình thường.
   → Sheet sẽ có 5 tab: **Chi tiêu, Lưu động, Danh mục, Tài sản, Cài đặt**.
5. Mở tab **Cài đặt** trong sheet và điền:
   - `OPENING_BALANCE`: số dư ví lúc bắt đầu dùng app.
   - `START_MONTH`: tháng bắt đầu, ví dụ `2026-09` (có thể để trống).
   - Nếu cần, điền **Số dư ban đầu** cho từng dòng trong tab **Tài sản**.
6. Bấm **Deploy › New deployment**. Ở ⚙ chọn **Web app**, rồi đặt:
   - *Execute as*: **Me**
   - *Who has access*: **Only myself**

   Bấm Deploy và copy **Web app URL** (dạng `https://script.google.com/macros/s/…/exec`).
7. Trên điện thoại, mở URL đó bằng Safari hoặc Chrome, đăng nhập đúng tài khoản Google, rồi chọn **Chia sẻ › Thêm vào Màn hình chính** để có icon như một app.

> Nếu điện thoại đang đăng nhập **nhiều tài khoản Google**, Apps Script đôi khi báo lỗi "không mở được file". Khi đó hãy mở link trong tab ẩn danh và chỉ đăng nhập tài khoản chủ sheet.

**Cập nhật code sau này:** sửa file trong Apps Script, sau đó vào **Deploy › Manage deployments › ✏️ › Version: New version › Deploy**. URL giữ nguyên.

## Quy ước dấu và cách tính

| Màn hình | Dấu − | Dấu + |
|---|---|---|
| Chi tiêu | Khoản chi (mặc định) | Khoản thu hoặc hoàn tiền |
| Lưu động | Tiền ra khỏi ví, chuyển vào nguồn (gửi tiết kiệm, cho vay…) | Tiền vào ví, lấy từ nguồn (rút tiết kiệm, được trả nợ, lương…) |

Số tiền được lưu vào sheet kèm dấu.

- **Tổng chi** của tháng = tổng các khoản chi trừ đi các khoản hoàn.
- **Balance** = balance tháng trước − tổng chi + tiền lưu động.
- **Balance tháng trước** được tính tự động: `OPENING_BALANCE` cộng mọi giao dịch từ `START_MONTH` đến trước tháng đang xem. Bạn không cần tự nhập mỗi tháng.
- **Số dư tài sản** = số dư ban đầu − các khoản lưu động có dấu + từ nguồn đó + các khoản có dấu − vào nguồn đó.
- **Ngày giờ** do server tự lấy lúc bấm Lưu, theo giờ Việt Nam.

## Tuỳ chỉnh mà không cần sửa code

| Muốn làm gì | Sửa ở đâu |
|---|---|
| Thêm, đổi tên, ẩn hoặc sắp xếp danh mục chi | Tab **Danh mục**: cột Tên, Icon (emoji), Màu (mã hex, dùng cho biểu đồ tròn), Đang dùng, Thứ tự |
| Thêm tài sản hoặc nguồn tiền | Tab **Tài sản**: tick **Bắt buộc ghi chú** để app hỏi thêm ghi chú (như "Khác"); bỏ tick **Theo dõi số dư** nếu không muốn nó hiện ở màn Tài sản |
| Số dư đầu, tên app, dấu mặc định | Tab **Cài đặt** |
| Sửa hoặc xoá một giao dịch cũ | Sửa trực tiếp trên tab **Chi tiêu** hoặc **Lưu động**. Trên app có thể xoá bằng cách bấm × hai lần |

Khi sửa hoặc thêm một dòng, **ô trống** trong cột Đang dùng hay Theo dõi số dư được hiểu là **có**. Chỉ khi bỏ tick checkbox (giá trị FALSE) thì mục đó mới bị tắt.

**Thêm một trường dữ liệu mới** (ví dụ "Hình thức thanh toán"): thêm key vào `SCHEMA` trong `Code.gs`, sau đó chạy lại `setup()`. Cột mới sẽ được thêm vào sheet có sẵn mà không mất dữ liệu cũ. Để nhập được trường đó từ điện thoại, bạn cần thêm một ô nhập vào `Index.html`, rồi thêm trường đó vào object được lưu trong `addExpense` / `addTransfer` ở `Code.gs`. Code tìm cột theo **tiêu đề**, nên bạn có thể đổi thứ tự cột trên sheet thoải mái, nhưng **đừng đổi tên tiêu đề cột**.
