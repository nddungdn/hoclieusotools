(function(){
  "use strict";

  const emptyCells=()=>({
    nb_mcq:{count:0,pct:0},nb_essay:{count:0,pct:0},
    th_mcq:{count:0,pct:0},th_essay:{count:0,pct:0},
    vd_mcq:{count:0,pct:0},vd_essay:{count:0,pct:0}
  });
  const row=(section,competency,unit,cells,shared=false)=>({section,competency,unit,cells:{...emptyCells(),...cells},shared});

  const genericMixed=[
    row("doc_hieu","Đọc hiểu","Ngữ liệu đọc hiểu",{nb_mcq:{count:4,pct:20},th_mcq:{count:3,pct:15},th_essay:{count:1,pct:10},vd_essay:{count:1,pct:15}}),
    row("viet","Viết","Kiểu bài viết theo phạm vi kiểm tra",{nb_essay:{count:1,pct:10},th_essay:{count:1,pct:15},vd_essay:{count:1,pct:15}},true)
  ];
  const genericEssay=[
    row("doc_hieu","Đọc hiểu","Ngữ liệu đọc hiểu",{nb_essay:{count:2,pct:15},th_essay:{count:3,pct:30},vd_essay:{count:1,pct:15}}),
    row("viet","Viết","Kiểu bài viết theo phạm vi kiểm tra",{nb_essay:{count:1,pct:10},th_essay:{count:1,pct:15},vd_essay:{count:1,pct:15}},true)
  ];

  const descriptors={
    "6":{
      doc_hieu:{
        nhan_biet:"- Nhận biết được đặc điểm hình thức của thể thơ tự do.\n- Nhận biết được các yếu tố tự sự và miêu tả trong thơ.\n- Nhận biết được tình cảm, cảm xúc của người viết thể hiện qua ngôn ngữ thơ.\n- Nhận ra từ đa nghĩa và từ đồng âm.",
        thong_hieu:"- Nêu được chủ đề của bài thơ.\n- Nhận xét được nét độc đáo của bài thơ qua từ ngữ, hình ảnh, biện pháp tu từ.\n- Chỉ ra tác dụng của các yếu tố tự sự, miêu tả trong thơ.\n- Nhận xét tác dụng của từ đa nghĩa, từ đồng âm.",
        van_dung:"- Trình bày được bài học về cách nghĩ và cách ứng xử gợi ra từ văn bản.\n- Đánh giá được giá trị của các yếu tố vần, nhịp."
      },
      viet:{
        nhan_biet:"- Xác định đúng kiểu bài viết đoạn văn ghi lại cảm xúc về một bài thơ/đoạn thơ.\n- Bố cục bảo đảm ba phần: mở đoạn, thân đoạn, kết đoạn.\n- Sử dụng ngôi thứ nhất để nêu cảm xúc chung về bài thơ.",
        thong_hieu:"- Trình bày được cảm xúc về nội dung và nghệ thuật của bài thơ.\n- Chỉ ra và nêu tác dụng của từ ngữ, hình ảnh, biện pháp nghệ thuật; các yếu tố tự sự, miêu tả.",
        van_dung:"- Đánh giá được ý nghĩa của văn bản.\n- Trình bày được thay đổi trong suy nghĩ, tình cảm, nhận thức của bản thân sau khi đọc.\n- Bảo đảm chính tả, ngữ pháp; diễn đạt sáng tạo, hợp logic; giọng văn chân thật, giàu cảm xúc."
      }
    },
    "8":{
      doc_hieu:{
        nhan_biet:"- Nhận biết được một số yếu tố của truyện ngắn: cốt truyện, nhân vật, lời người kể chuyện và lời nhân vật.\n- Nhận biết được trợ từ, thán từ trong ngữ cảnh.",
        thong_hieu:"- Phân tích được tình cảm, thái độ của người kể chuyện qua ngôn ngữ và giọng điệu.\n- Phân tích được chủ đề, tư tưởng, thông điệp qua hình thức nghệ thuật.\n- Giải thích được tác dụng của trợ từ, thán từ trong ngữ cảnh.",
        van_dung:"- Nêu được thay đổi trong suy nghĩ, tình cảm hoặc cách sống sau khi đọc tác phẩm.\n- Vận dụng trải nghiệm để đánh giá vấn đề đặt ra trong văn bản."
      },
      viet:{
        nhan_biet:"- Xác định đúng kiểu bài nghị luận phân tích một tác phẩm văn học (truyện).\n- Bảo đảm bố cục ba phần và dung lượng theo yêu cầu.",
        thong_hieu:"- Phân tích được chủ đề của truyện.\n- Phân tích được tác dụng của một số nét đặc sắc nghệ thuật của tác phẩm.",
        van_dung:"- Vận dụng kĩ năng nghị luận để triển khai luận điểm, lí lẽ và bằng chứng phù hợp.\n- Bảo đảm chính tả, ngữ pháp; diễn đạt sáng tạo, có cảm xúc và dấu ấn cá nhân."
      }
    }
  };

  window.RADENGUVAN_DATA=Object.freeze({
    providers:{gemini:"gemini-2.5-flash",openrouter:"google/gemini-2.5-flash",openai:"gpt-4.1-mini"},
    labels:{
      levels:{nhan_biet:"Nhận biết",thong_hieu:"Thông hiểu",van_dung:"Vận dụng"},
      sections:{doc_hieu:"Đọc",viet:"Viết"},
      cellLevels:{nb:"Nhận biết",th:"Thông hiểu",vd:"Vận dụng"},
      questionTypes:{mcq:"TNKQ",essay:"TL"}
    },
    cellKeys:["nb_mcq","nb_essay","th_mcq","th_essay","vd_mcq","vd_essay"],
    descriptors,
    defaults:{mixed:genericMixed,essay:genericEssay}
  });
})();
