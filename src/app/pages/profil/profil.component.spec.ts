import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { ProfilComponent } from './profil.component';

describe('ProfilComponent', () => {
  let component: ProfilComponent;
  let fixture: ComponentFixture<ProfilComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfilComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfilComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
