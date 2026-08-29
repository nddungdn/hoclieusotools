(function(){
  "use strict";
  const reading = {
    nhan_biet:[
      "Nhận biết được thể loại/kiểu văn bản và những dấu hiệu hình thức tiêu biểu.",
      "Nhận biết được thông tin, chi tiết, hình ảnh, nhân vật hoặc sự việc được thể hiện trực tiếp trong ngữ liệu.",
      "Nhận biết được đặc điểm của từ ngữ, câu và biện pháp tu từ trong ngữ cảnh."
    ],
    thong_hieu:[
      "Phân tích được nội dung, chủ đề, thông điệp và tác dụng của chi tiết tiêu biểu trong ngữ liệu.",
      "Giải thích được tác dụng của cách tổ chức ngôn ngữ, biện pháp tu từ hoặc yếu tố hình thức đối với việc biểu đạt nội dung.",
      "Suy luận được ý nghĩa của thông tin, hình ảnh hoặc mối quan hệ giữa các chi tiết trong ngữ liệu."
    ],
    van_dung:[
      "Vận dụng hiểu biết từ ngữ liệu để nêu quan điểm, bài học hoặc cách ứng xử phù hợp; lí giải rõ ràng.",
      "Liên hệ nội dung ngữ liệu với một tình huống gần gũi trong học tập và đời sống."
    ]
  };
  const writing = {
    nhan_biet:["Xác định đúng yêu cầu về nội dung, kiểu bài, phạm vi và hình thức của bài viết."],
    thong_hieu:["Triển khai được nội dung đúng đặc trưng kiểu bài; bảo đảm bố cục và mạch liên kết cơ bản."],
    van_dung:["Vận dụng kĩ năng tạo lập văn bản để trình bày hệ thống ý rõ ràng, có lí lẽ và bằng chứng phù hợp."],
    van_dung_cao:["Thể hiện suy nghĩ sâu sắc, diễn đạt có dấu ấn cá nhân và sử dụng ngôn ngữ linh hoạt, thuyết phục."]
  };
  window.RADENGUVAN_DATA = Object.freeze({
    providers:{
      gemini:"gemini-2.5-flash",
      openrouter:"google/gemini-2.5-flash",
      openai:"gpt-4.1-mini"
    },
    labels:{
      levels:{nhan_biet:"Nhận biết",thong_hieu:"Thông hiểu",van_dung:"Vận dụng",van_dung_cao:"Vận dụng cao"},
      sections:{doc_hieu:"Đọc hiểu",viet:"Viết"},
      questionTypes:{trac_nghiem:"Trắc nghiệm nhiều lựa chọn",dung_sai:"Trắc nghiệm đúng/sai",tra_loi_ngan:"Trả lời ngắn",tu_luan:"Tự luận"}
    },
    descriptors:{reading,writing},
    defaults:{
      mixed:[
        {section:"doc_hieu",unit:"Ngữ liệu đọc hiểu",qtype:"trac_nghiem",level:"nhan_biet",count:4,point:0.5},
        {section:"doc_hieu",unit:"Ngữ liệu đọc hiểu",qtype:"trac_nghiem",level:"thong_hieu",count:2,point:0.5},
        {section:"doc_hieu",unit:"Ngữ liệu đọc hiểu",qtype:"tu_luan",level:"thong_hieu",count:1,point:1},
        {section:"doc_hieu",unit:"Ngữ liệu đọc hiểu",qtype:"tu_luan",level:"van_dung",count:1,point:1},
        {section:"viet",unit:"Viết",qtype:"tu_luan",level:"van_dung",count:1,point:5}
      ],
      essay:[
        {section:"doc_hieu",unit:"Ngữ liệu đọc hiểu",qtype:"tu_luan",level:"nhan_biet",count:2,point:0.5},
        {section:"doc_hieu",unit:"Ngữ liệu đọc hiểu",qtype:"tu_luan",level:"thong_hieu",count:2,point:1},
        {section:"doc_hieu",unit:"Ngữ liệu đọc hiểu",qtype:"tu_luan",level:"van_dung",count:1,point:1},
        {section:"viet",unit:"Viết",qtype:"tu_luan",level:"van_dung",count:1,point:6}
      ]
    }
  });
})();
