import { useNavigate } from "react-router-dom";
import { Button, Card } from "../../../shared/ui";
import { LoginForm } from "../../../features/login-with-credentials";
import brandImage from "./mascot-granddaughter-greeting.png";
import styles from "./LoginPage.module.css";

// LOGIN_01 (UC-00)
export function LoginPage() {
  const navigate = useNavigate();

  return (
    <main className={styles.page}>
      <div className={styles.brand}>
        <img
          src={brandImage}
          alt="마음잇다 — 마음을 연결하는 따뜻한 안부"
          className={styles.brandImage}
        />
      </div>

      <Card>
        <h2 className={styles.subheading}>로그인하고 마음이와 대화해요</h2>
        <LoginForm />

        <div className={styles.divider}>
          <span>또는</span>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/join")}
        >
          회원가입
        </Button>

        {/* 개인정보 처리방침 페이지가 아직 없어 링크가 아니라 텍스트만 강조함. */}
        <p className={styles.footer}>
          서비스 이용 시{" "}
          <span className={styles.footerHighlight}>개인정보 처리방침</span>에
          동의하게 됩니다.
        </p>
      </Card>
    </main>
  );
}
